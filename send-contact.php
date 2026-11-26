<?php
declare(strict_types=1);

/*
 * Afstor website enquiry endpoint.
 *
 *   GET  send-contact.php?action=token  -> issues a CSRF token for this browser session
 *                                          (and the Cloudflare Turnstile site key, if configured)
 *   POST send-contact.php (JSON)        -> validates the enquiry and emails the right team
 *
 * Security layers, in order: same-origin check, content type and size limits, honeypot,
 * field allow-list, CSRF token, minimum fill time, Turnstile (when configured), strict
 * per-field validation, per-IP rate limit. Error messages never reveal system details.
 *
 * Private files (config, rate-limit state, logs) live OUTSIDE the web root in
 * ../afstor-private/. Optional config file ../afstor-private/config.php returning:
 *   ['turnstile_site_key' => '...', 'turnstile_secret_key' => '...', 'ip_salt' => 'long random string']
 * Environment variables TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY and AFSTOR_IP_SALT override it.
 * See src/SECURITY.md.
 */

ini_set('display_errors', '0');
ini_set('log_errors', '1');
header_remove('X-Powered-By');

const MAX_BODY_BYTES = 12000;
const RATE_LIMIT_MAX = 5;          // submissions...
const RATE_LIMIT_WINDOW = 600;     // ...per 10 minutes, per IP
const MIN_FILL_SECONDS = 3;        // sent faster than this after page load = likely a bot
const LOG_RETENTION_DAYS = 90;
const SENDER = 'noreply@afstor.co.ke'; // fixed From address; the visitor's email is only ever Reply-To
const MSG_GENERIC = 'We could not process your enquiry. Please refresh the page and try again, or call or WhatsApp us on +254 181 100 200.';

/* Where each stakeholder group's enquiries go. */
$ROUTES = [
    'household'   => ['team' => 'Sales',                       'to' => 'sales.ke@afstor.com'],
    'support'     => ['team' => 'Customer support',            'to' => 'sales.ke@afstor.com'],
    'distributor' => ['team' => 'Partnerships (distributors)', 'to' => 'sales.ke@afstor.com'],
    'institution' => ['team' => 'Institutional sales',         'to' => 'sales.ke@afstor.com'],
    'development' => ['team' => 'Partnerships (development)',  'to' => 'office@afstor.com'],
    'investor'    => ['team' => 'Investor & government',       'to' => 'office@afstor.com'],
    'general'     => ['team' => 'General',                     'to' => 'office@afstor.com'],
];

/* Allow-list patterns (Unicode-aware, so Kenyan and international names work). */
const P_NAME  = '/^[\p{L}\p{M}][\p{L}\p{M}\' .\-’]*$/u';
const P_PLACE = '/^[\p{L}\p{M}][\p{L}\p{M}\p{N} ,.\'’()\/\-]*$/u';
const P_TEXT  = '/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} &.,\'’()\/:+#%\-]*$/u';

/* Extra fields: [label, max length, regex pattern OR list of allowed values]. */
$FIELDS = [
    'organisation'       => ['Organisation', 150, P_TEXT],
    'county'             => ['County / territory', 80, P_PLACE],
    'role'               => ['Role', 120, P_TEXT],
    'people_served'      => ['People fed daily', 7, '/^[1-9][0-9]{0,6}$/'],
    'current_reach'      => ['Current reach', 160, P_TEXT],
    'geography'          => ['Programme geography', 120, P_PLACE],
    'request_type'       => ['Request', 60, ['Buy a system', 'Book a product demonstration', 'Get support for my system', 'Request investor information', 'Schedule a meeting']],
    'product_interest'   => ['Product of interest', 60, ['Solar-Induction Cooking System', '450W Solar Panels', 'Not sure yet']],
    'payment_preference' => ['Payment preference', 40, ['Pay-as-you-go', 'Full payment', 'Not sure yet']],
    'business_type'      => ['Business type', 60, ['Solar / electronics dealer', 'Retail store', 'SACCO / microfinance', 'Agent network', 'NGO / implementation partner', 'Other']],
    'institution_type'   => ['Institution type', 60, ['School', 'College / university', 'Clinic / hospital', 'Church / faith organisation', 'Community group', 'Other']],
    'current_fuel'       => ['Current cooking fuel', 40, ['Firewood', 'Charcoal', 'LPG', 'Grid electricity', 'Mixed / other']],
    'org_type'           => ['Organisation type', 60, ['NGO', 'Foundation', 'UN agency / multilateral', 'Bilateral donor', 'Community-based organisation', 'Other']],
    'programme_scale'    => ['Target scale', 60, ['Under 100 households', '100 – 1,000 households', '1,000 – 10,000 households', 'More than 10,000 households', 'Institutions only', 'Not yet defined']],
    'investor_type'      => ['Organisation type', 60, ['Impact investor / VC', 'Development finance institution', 'Climate / carbon finance', 'Bank / debt provider', 'National government', 'County government', 'Other']],
    'interest'           => ['Area of interest', 60, ['Equity', 'Debt / PAYG working capital', 'Carbon credits / results-based finance', 'Government or county programme', 'Other']],
];

/* Which extra fields each stakeholder form may send, and which are required. */
$AUDIENCES = [
    'household'   => ['fields' => ['county', 'request_type', 'payment_preference', 'product_interest'], 'required' => ['county']],
    'support'     => ['fields' => ['county'], 'required' => [], 'message_required' => true],
    'distributor' => ['fields' => ['organisation', 'county', 'business_type', 'current_reach'], 'required' => ['organisation', 'county']],
    'institution' => ['fields' => ['organisation', 'institution_type', 'county', 'people_served', 'current_fuel'], 'required' => ['organisation', 'county']],
    'development' => ['fields' => ['organisation', 'org_type', 'geography', 'programme_scale'], 'required' => ['organisation']],
    'investor'    => ['fields' => ['request_type', 'organisation', 'role', 'investor_type', 'interest'], 'required' => ['organisation']],
    'general'     => ['fields' => [], 'required' => [], 'message_required' => true],
];

/* Fields every form sends. Anything not here or in the audience's own list is rejected. */
const BASE_FIELDS = ['audience', 'name', 'email', 'phone', 'message', 'consent', 'website', 'source_page', 'csrf_token', 'cf_turnstile_response'];

/* ------------------------------------------------------------------ helpers */

function respond(int $status, bool $ok, string $message, array $extra = []): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode(['ok' => $ok, 'message' => $message] + $extra, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    exit;
}

function isUtf8(string $value): bool
{
    return function_exists('mb_check_encoding') ? mb_check_encoding($value, 'UTF-8') : preg_match('//u', $value) === 1;
}

function textLength(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : (int) preg_match_all('/./us', $value);
}

function truncate(string $value, int $max): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $max, 'UTF-8');
    }
    preg_match('/^.{0,' . $max . '}/us', $value, $m);
    return $m[0] ?? '';
}

function isJsonObject($value): bool
{
    return is_array($value) && ($value === [] || array_keys($value) !== range(0, count($value) - 1));
}

/** Directory for private state, outside the public web root. */
function privateDir(): string
{
    static $dir = null;
    if ($dir !== null) {
        return $dir;
    }
    $candidates = [
        dirname(__DIR__) . '/afstor-private',
        rtrim(sys_get_temp_dir(), '/\\') . '/afstor-private-' . substr(hash('sha256', __DIR__), 0, 12),
    ];
    foreach ($candidates as $candidate) {
        if ((is_dir($candidate) || @mkdir($candidate, 0700, true)) && is_writable($candidate)) {
            return $dir = $candidate;
        }
    }
    return $dir = '';
}

function config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    $config = [];
    $file = dirname(__DIR__) . '/afstor-private/config.php';
    if (is_file($file)) {
        $loaded = include $file;
        if (is_array($loaded)) {
            $config = $loaded;
        }
    }
    foreach (['TURNSTILE_SITE_KEY' => 'turnstile_site_key', 'TURNSTILE_SECRET_KEY' => 'turnstile_secret_key', 'AFSTOR_IP_SALT' => 'ip_salt'] as $env => $key) {
        $value = getenv($env);
        if (is_string($value) && $value !== '') {
            $config[$key] = $value;
        }
    }
    return $config;
}

/** Salted hash of the visitor's IP: lets us rate-limit and spot abuse without storing the IP. */
function clientKey(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    $salt = (string) (config()['ip_salt'] ?? __DIR__);
    return substr(hash('sha256', $salt . '|' . $ip), 0, 32);
}

/** Records blocked or failed submissions. Never writes names, emails, messages or raw IPs. */
function logEvent(string $event): void
{
    $dir = privateDir();
    if ($dir === '') {
        return;
    }
    $logDir = $dir . '/logs';
    if (!is_dir($logDir) && !@mkdir($logDir, 0700, true)) {
        return;
    }
    $host = (string) preg_replace('/[^a-z0-9.\-]/i', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
    $line = gmdate('c') . "\t" . substr($host, 0, 80) . "\tform\t" . $event . "\t" . clientKey() . "\n";
    @file_put_contents($logDir . '/security-' . gmdate('Y-m') . '.log', $line, FILE_APPEND | LOCK_EX);
    foreach (glob($logDir . '/*.log') ?: [] as $old) {
        if (filemtime($old) < time() - LOG_RETENTION_DAYS * 86400) {
            @unlink($old);
        }
    }
}

function isHttps(): bool
{
    return (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
        || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function startSecureSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('afstor_form');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => isHttps(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    if (!@session_start()) {
        respond(503, false, MSG_GENERIC);
    }
}

/** The request must come from a page on this same site (Origin, or Referer as a fallback). */
function isSameOrigin(): bool
{
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $source = (string) ($_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? ''));
    if ($host === '' || $source === '' || $source === 'null') {
        return false;
    }
    $parts = parse_url($source);
    if (!is_array($parts) || empty($parts['host'])) {
        return false;
    }
    $sourceHost = strtolower($parts['host']) . (isset($parts['port']) ? ':' . $parts['port'] : '');
    return hash_equals($host, $sourceHost);
}

/** Removes null bytes and control characters; keeps line breaks and tabs only when $multiline. */
function stripControl(string $value, bool $multiline): string
{
    $value = str_replace("\0", '', $value);
    if ($multiline) {
        $value = str_replace(["\r\n", "\r"], "\n", $value);
        return (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x{2028}\x{2029}]/u', '', $value);
    }
    return (string) preg_replace('/[\x00-\x1F\x7F\x{2028}\x{2029}]+/u', ' ', $value);
}

/** Single-line value: valid UTF-8 string, control characters removed, trimmed, within $max. */
function cleanLine($value, int $max): ?string
{
    if (!is_string($value) || !isUtf8($value)) {
        return null;
    }
    $value = trim((string) preg_replace('/\s{2,}/u', ' ', stripControl($value, false)));
    return textLength($value) <= $max ? $value : null;
}

/** Kenyan formats (07xx / 01xx / +254 / 254) and international numbers (E.164). */
function isValidPhone(string $phone): bool
{
    if (!preg_match('/^\+?[0-9][0-9 \-]{6,18}[0-9]$/', $phone)) {
        return false;
    }
    $digits = (string) preg_replace('/\D/', '', $phone);
    if ($phone[0] === '+') {
        if (strncmp($digits, '254', 3) === 0) {
            return preg_match('/^254[17][0-9]{8}$/', $digits) === 1;
        }
        return strlen($digits) >= 8 && strlen($digits) <= 15;
    }
    if ($digits[0] === '0') {
        return preg_match('/^0[17][0-9]{8}$/', $digits) === 1;
    }
    return preg_match('/^254[17][0-9]{8}$/', $digits) === 1;
}

/** Per-IP rate limit, stored in a small file outside the web root. */
function rateLimitExceeded(): bool
{
    $dir = privateDir();
    if ($dir === '') {
        return false;
    }
    $rlDir = $dir . '/ratelimit';
    if (!is_dir($rlDir) && !@mkdir($rlDir, 0700, true)) {
        return false;
    }
    $handle = @fopen($rlDir . '/' . clientKey() . '.json', 'c+');
    if ($handle === false) {
        return false;
    }
    flock($handle, LOCK_EX);
    $now = time();
    $stamps = json_decode((string) stream_get_contents($handle), true);
    $stamps = array_values(array_filter(is_array($stamps) ? $stamps : [], static function ($t) use ($now) {
        return is_int($t) && $t > $now - RATE_LIMIT_WINDOW;
    }));
    $limited = count($stamps) >= RATE_LIMIT_MAX;
    if (!$limited) {
        $stamps[] = $now;
    }
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, (string) json_encode($stamps));
    flock($handle, LOCK_UN);
    fclose($handle);
    if (mt_rand(1, 50) === 1) {
        foreach (glob($rlDir . '/*.json') ?: [] as $old) {
            if (filemtime($old) < $now - RATE_LIMIT_WINDOW) {
                @unlink($old);
            }
        }
    }
    return $limited;
}

/** Cloudflare Turnstile check. Skipped (returns true) until a secret key is configured. */
function verifyTurnstile(string $token): bool
{
    $secret = (string) (config()['turnstile_secret_key'] ?? '');
    if ($secret === '') {
        return true;
    }
    if ($token === '' || strlen($token) > 2048) {
        return false;
    }
    $body = http_build_query(['secret' => $secret, 'response' => $token, 'remoteip' => (string) ($_SERVER['REMOTE_ADDR'] ?? '')]);
    $url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 6,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        ]);
        $result = curl_exec($ch);
        curl_close($ch);
    } else {
        $result = @file_get_contents($url, false, stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => $body,
            'timeout' => 6,
        ]]));
    }
    $decoded = is_string($result) ? json_decode($result, true) : null;
    return is_array($decoded) && ($decoded['success'] ?? false) === true;
}

/* ------------------------------------------------------------------ token request */

$method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'GET' && ($_GET['action'] ?? '') === 'token') {
    startSecureSession();
    if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    $_SESSION['form_loaded_at'] = time();
    $token = $_SESSION['csrf_token'];
    session_write_close();
    respond(200, true, 'ready', [
        'token' => $token,
        'turnstile_site_key' => (string) (config()['turnstile_site_key'] ?? ''),
    ]);
}

/* ------------------------------------------------------------------ submission */

if ($method !== 'POST') {
    header('Allow: GET, POST');
    respond(405, false, 'This address only accepts form submissions.');
}

if (!isSameOrigin()) {
    logEvent('cross_origin');
    respond(403, false, MSG_GENERIC);
}

if (strpos(strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? '')), 'application/json') !== 0) {
    logEvent('content_type');
    respond(415, false, MSG_GENERIC);
}

if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > MAX_BODY_BYTES) {
    respond(413, false, 'Your enquiry is too long. Please shorten your message and try again.');
}
$rawBody = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
if ($rawBody === false || strlen($rawBody) > MAX_BODY_BYTES) {
    respond(413, false, 'Your enquiry is too long. Please shorten your message and try again.');
}

$payload = json_decode($rawBody, true, 4);
if (!isJsonObject($payload)) {
    logEvent('bad_json');
    respond(400, false, MSG_GENERIC);
}

/* Honeypot: real visitors never see or fill this field. Pretend success so bots learn nothing. */
if (($payload['website'] ?? '') !== '') {
    logEvent('honeypot');
    respond(200, true, 'Your enquiry has reached our team. We will be in touch soon.');
}

$audience = cleanLine($payload['audience'] ?? '', 20);
if ($audience === null || !isset($AUDIENCES[$audience], $ROUTES[$audience])) {
    respond(422, false, 'Please tell us who you are contacting us as.');
}
$audienceConfig = $AUDIENCES[$audience];

/* Reject unexpected fields, and any value that is not a plain string. */
$allowedKeys = array_merge(BASE_FIELDS, $audienceConfig['fields']);
foreach ($payload as $key => $value) {
    if (!is_string($key) || !in_array($key, $allowedKeys, true) || !is_string($value)) {
        logEvent('unexpected_field');
        respond(400, false, MSG_GENERIC);
    }
}

/* CSRF token, bound to this browser session. */
startSecureSession();
$sessionToken = $_SESSION['csrf_token'] ?? '';
$sentToken = (string) ($payload['csrf_token'] ?? '');
if (!is_string($sessionToken) || $sessionToken === '' || !hash_equals($sessionToken, $sentToken)) {
    session_write_close();
    logEvent('csrf');
    respond(403, false, 'Your session has expired. Please try sending again.', ['code' => 'token']);
}

/* Sent faster than a person could fill the form in. */
$loadedAt = (int) ($_SESSION['form_loaded_at'] ?? 0);
if ($loadedAt === 0 || time() - $loadedAt < MIN_FILL_SECONDS) {
    session_write_close();
    logEvent('too_fast');
    respond(429, false, 'Please take a moment to check your details, then send again.', ['code' => 'too_fast']);
}

if (!verifyTurnstile((string) ($payload['cf_turnstile_response'] ?? ''))) {
    session_write_close();
    logEvent('captcha');
    respond(403, false, 'We could not confirm you are human. Please refresh the page and try again.', ['code' => 'captcha']);
}

/* ---- field validation (allow-list) ---- */

if (($payload['consent'] ?? '') !== 'yes') {
    respond(422, false, 'Please confirm you agree to our Privacy Policy so we can respond.');
}

$name = cleanLine($payload['name'] ?? null, 100);
if ($name === null || textLength($name) < 2 || preg_match(P_NAME, $name) !== 1) {
    respond(422, false, 'Enter your name using letters, spaces, hyphens or apostrophes (2 to 100 characters).');
}

$email = cleanLine($payload['email'] ?? null, 254);
if ($email === null || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    respond(422, false, 'Enter a valid email address.');
}

$phone = cleanLine($payload['phone'] ?? '', 20);
if ($phone === null || ($phone !== '' && !isValidPhone($phone))) {
    respond(422, false, 'Enter a valid phone number, for example 0712 345 678 or +254 712 345 678.');
}

$details = [];
foreach ($audienceConfig['fields'] as $key) {
    [$label, $max, $rule] = $FIELDS[$key];
    $value = cleanLine($payload[$key] ?? '', $max);
    if ($value === null) {
        respond(422, false, $label . ' is too long or contains characters we cannot accept.');
    }
    if ($value === '') {
        if (in_array($key, $audienceConfig['required'], true)) {
            respond(422, false, 'Please fill in: ' . $label . '.');
        }
        continue;
    }
    $valid = is_array($rule) ? in_array($value, $rule, true) : preg_match($rule, $value) === 1;
    if (!$valid) {
        respond(422, false, is_array($rule) ? 'Choose a listed option for ' . $label . '.' : $label . ' contains characters we cannot accept.');
    }
    $details[$label] = $value;
}

$message = (string) ($payload['message'] ?? '');
if (!isUtf8($message)) {
    respond(422, false, 'Your message contains characters we cannot accept.');
}
$message = trim(stripControl($message, true));
$messageRequired = !empty($audienceConfig['message_required']);
if (textLength($message) > 2000) {
    respond(422, false, 'Please keep your message under 2,000 characters.');
}
if ($messageRequired && textLength($message) < 10) {
    respond(422, false, 'Please describe your enquiry in at least 10 characters.');
}

$sourcePage = cleanLine($payload['source_page'] ?? '', 60);
if ($sourcePage === null || preg_match('/^[a-z0-9\-]{1,50}\.html$/', $sourcePage) !== 1) {
    $sourcePage = '';
}

/* ---- abuse limits ---- */

$lastSubmission = (int) ($_SESSION['last_submission'] ?? 0);
if ($lastSubmission > 0 && time() - $lastSubmission < 20) {
    session_write_close();
    respond(429, false, 'Please wait a moment before sending another enquiry.');
}
if (rateLimitExceeded()) {
    session_write_close();
    logEvent('rate_limited');
    respond(429, false, 'You have sent several enquiries in a short time. Please wait about 10 minutes, or call or WhatsApp us on +254 181 100 200.');
}

/* ---- email: plain text only; user input never reaches a header except the validated Reply-To ---- */

$route = $ROUTES[$audience];
$subject = '[Afstor Website · ' . $route['team'] . '] '
    . (isset($details['Request']) ? $details['Request'] . ' · ' : '')
    . ($details['Organisation'] ?? $name);
$subject = truncate(stripControl($subject, false), 180);

$lines = [
    'New enquiry from the Afstor website',
    '',
    'Routed to: ' . $route['team'],
    'Stakeholder: ' . $audience,
    'Page: ' . ($sourcePage !== '' ? $sourcePage : 'Unknown'),
    '',
    'Name: ' . $name,
    'Email: ' . $email,
    'Phone: ' . ($phone !== '' ? $phone : 'Not provided'),
];
foreach ($details as $label => $value) {
    $lines[] = $label . ': ' . $value;
}
$lines[] = 'Privacy consent: given';
$lines[] = '';
$lines[] = 'Message:';
$lines[] = $message !== '' ? $message : '(none)';

$headers = implode("\r\n", [
    'From: Afstor Website <' . SENDER . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
]);

if (!mail($route['to'], '=?UTF-8?B?' . base64_encode($subject) . '?=', implode("\n", $lines), $headers, '-f' . SENDER)) {
    session_write_close();
    logEvent('mail_failed:' . $audience);
    respond(503, false, 'We could not send your enquiry right now. Please call or WhatsApp us on +254 181 100 200.');
}

$newToken = bin2hex(random_bytes(32)); // fresh token after each successful submission
$_SESSION['last_submission'] = time();
$_SESSION['csrf_token'] = $newToken;
session_write_close();
respond(200, true, 'Your enquiry has reached our ' . strtolower($route['team']) . ' team. We will be in touch soon.', ['token' => $newToken]);
