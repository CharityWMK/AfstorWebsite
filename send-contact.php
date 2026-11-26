<?php
declare(strict_types=1);

/*
 * Afstor website enquiry endpoint.
 *
 * Every form posts JSON with an `audience` value. The audience decides:
 *   - which extra fields are accepted (anything else is ignored),
 *   - which fields are required,
 *   - which team inbox receives the enquiry.
 *
 * To change where enquiries go, edit $ROUTES below.
 */

$ROUTES = [
    'household'   => ['team' => 'Sales',                       'to' => 'sales.ke@afstor.com'],
    'support'     => ['team' => 'Customer support',            'to' => 'sales.ke@afstor.com'],
    'distributor' => ['team' => 'Partnerships (distributors)', 'to' => 'sales.ke@afstor.com'],
    'institution' => ['team' => 'Institutional sales',         'to' => 'sales.ke@afstor.com'],
    'development' => ['team' => 'Partnerships (development)',  'to' => 'office@afstor.com'],
    'investor'    => ['team' => 'Investor & government',       'to' => 'office@afstor.com'],
    'general'     => ['team' => 'General',                     'to' => 'office@afstor.com'],
];

$SENDER = 'noreply@afstor.co.ke';

/* Field definitions: label, max length, allowed values (null = free text). */
$FIELDS = [
    'organisation'       => ['Organisation', 160, null],
    'county'             => ['County / territory', 80, null],
    'role'               => ['Role', 120, null],
    'people_served'      => ['People fed daily', 20, null],
    'current_reach'      => ['Current reach', 160, null],
    'geography'          => ['Programme geography', 120, null],
    'request_type'       => ['Request', 60, [
        'Buy a system', 'Book a product demonstration', 'Get support for my system',
        'Request investor information', 'Schedule a meeting',
    ]],
    'product_interest'   => ['Product of interest', 60, ['Solar-Induction Cooking System', '450W Solar Panels', 'Not sure yet']],
    'payment_preference' => ['Payment preference', 40, ['Pay-as-you-go', 'Full payment', 'Not sure yet']],
    'business_type'      => ['Business type', 60, [
        'Solar / electronics dealer', 'Retail shop', 'SACCO / microfinance', 'Agent network', 'NGO / implementation partner', 'Other',
    ]],
    'institution_type'   => ['Institution type', 60, [
        'School', 'College / university', 'Clinic / hospital', 'Church / faith organisation', 'Community group', 'Other',
    ]],
    'current_fuel'       => ['Current cooking fuel', 40, ['Firewood', 'Charcoal', 'LPG', 'Grid electricity', 'Mixed / other']],
    'org_type'           => ['Organisation type', 60, [
        'NGO', 'Foundation', 'UN agency / multilateral', 'Bilateral donor', 'Community-based organisation', 'Other',
    ]],
    'programme_scale'    => ['Target scale', 60, [
        'Under 100 households', '100 – 1,000 households', '1,000 – 10,000 households',
        'More than 10,000 households', 'Institutions only', 'Not yet defined',
    ]],
    'investor_type'      => ['Organisation type', 60, [
        'Impact investor / VC', 'Development finance institution', 'Climate / carbon finance', 'Bank / debt provider',
        'National government', 'County government', 'Other',
    ]],
    'interest'           => ['Area of interest', 60, [
        'Equity', 'Debt / PAYG working capital', 'Carbon credits / results-based finance', 'Government or county programme', 'Other',
    ]],
];

/* Which extra fields each audience may send, and which of them are required. */
$AUDIENCES = [
    'household'   => ['fields' => ['county', 'request_type', 'payment_preference', 'product_interest'], 'required' => ['county']],
    'support'     => ['fields' => ['county'], 'required' => [], 'message_required' => true],
    'distributor' => ['fields' => ['organisation', 'county', 'business_type', 'current_reach'], 'required' => ['organisation', 'county']],
    'institution' => ['fields' => ['organisation', 'institution_type', 'county', 'people_served', 'current_fuel'], 'required' => ['organisation', 'county']],
    'development' => ['fields' => ['organisation', 'org_type', 'geography', 'programme_scale'], 'required' => ['organisation']],
    'investor'    => ['fields' => ['request_type', 'organisation', 'role', 'investor_type', 'interest'], 'required' => ['organisation']],
    'general'     => ['fields' => [], 'required' => [], 'message_required' => true],
];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, bool $ok, string $message): void
{
    http_response_code($status);
    echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function textLength(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function cleanSingleLine($value, int $maxLength): ?string
{
    if (!is_string($value)) {
        return null;
    }
    $value = preg_replace('/[\r\n\t]+/', ' ', $value);
    if ($value === null) {
        return null;
    }
    $value = trim($value);
    if (textLength($value) > $maxLength || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value)) {
        return null;
    }
    return $value;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, false, 'This endpoint only accepts form submissions.');
}

if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 16000) {
    respond(413, false, 'Your enquiry is too long. Please shorten it and try again.');
}

$rawBody = file_get_contents('php://input', false, null, 0, 16001);
if ($rawBody === false || strlen($rawBody) > 16000) {
    respond(413, false, 'Your enquiry is too long. Please shorten it and try again.');
}

$payload = json_decode($rawBody, true);
if (!is_array($payload)) {
    respond(400, false, 'The form data could not be read. Please refresh the page and try again.');
}

/* Honeypot: real visitors never fill this in. */
$website = cleanSingleLine($payload['website'] ?? '', 200);
if ($website === null || $website !== '') {
    respond(422, false, 'We could not process this submission. Please try again.');
}

$audience = cleanSingleLine($payload['audience'] ?? '', 20);
if ($audience === null || !isset($AUDIENCES[$audience], $ROUTES[$audience])) {
    respond(422, false, 'Please tell us who you are contacting us as.');
}
$audienceConfig = $AUDIENCES[$audience];

$name = cleanSingleLine($payload['name'] ?? null, 120);
if ($name === null || textLength($name) < 2) {
    respond(422, false, 'Enter your name using 2 to 120 characters.');
}

$email = is_string($payload['email'] ?? null) ? trim($payload['email']) : '';
if (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    respond(422, false, 'Enter a valid email address.');
}

$phone = cleanSingleLine($payload['phone'] ?? '', 40);
if ($phone === null || ($phone !== '' && !preg_match('/^[0-9+\-(). ]{7,40}$/', $phone))) {
    respond(422, false, 'Enter a valid phone number.');
}

$details = [];
foreach ($audienceConfig['fields'] as $key) {
    [$label, $max, $allowed] = $FIELDS[$key];
    $value = cleanSingleLine($payload[$key] ?? '', $max);
    if ($value === null) {
        respond(422, false, $label . ' is too long or contains invalid characters.');
    }
    if ($value === '' && in_array($key, $audienceConfig['required'], true)) {
        respond(422, false, 'Please fill in: ' . $label . '.');
    }
    if ($value !== '' && $allowed !== null && !in_array($value, $allowed, true)) {
        respond(422, false, 'Choose a listed option for ' . $label . '.');
    }
    if ($value !== '') {
        $details[$label] = $value;
    }
}

$message = $payload['message'] ?? '';
if (!is_string($message)) {
    respond(422, false, 'Your message could not be read.');
}
$message = str_replace(["\r\n", "\r"], "\n", trim($message));
$message = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $message) ?? '';
$messageRequired = !empty($audienceConfig['message_required']);
if (textLength($message) > 3000 || ($messageRequired && textLength($message) < 10)) {
    respond(422, false, $messageRequired
        ? 'Describe your enquiry in 10 to 3000 characters.'
        : 'Please keep your message under 3000 characters.');
}

$sourcePage = cleanSingleLine($payload['source_page'] ?? '', 80);
if ($sourcePage === null || !preg_match('/^[a-z0-9-]*\.?(html)?$/', $sourcePage)) {
    $sourcePage = '';
}

if (session_status() !== PHP_SESSION_ACTIVE && !session_start()) {
    respond(503, false, 'We could not process your enquiry right now. Please try again later.');
}
$now = time();
$lastSubmission = (int) ($_SESSION['afstor_contact_last_submission'] ?? 0);
if ($lastSubmission > 0 && $now - $lastSubmission < 20) {
    respond(429, false, 'Please wait a moment before sending another enquiry.');
}

$route = $ROUTES[$audience];
$subjectParts = ['[Afstor Website · ' . $route['team'] . ']'];
if (isset($details['Request'])) {
    $subjectParts[] = $details['Request'];
}
$subjectParts[] = isset($details['Organisation']) ? $details['Organisation'] : $name;
$subject = implode(' ', $subjectParts);

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
$lines[] = '';
$lines[] = 'Message:';
$lines[] = $message !== '' ? $message : '(none)';

$headers = implode("\r\n", [
    'From: Afstor Website <' . $SENDER . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'X-Mailer: PHP/' . PHP_VERSION,
]);

$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
if (!mail($route['to'], $encodedSubject, implode("\n", $lines), $headers, '-f' . $SENDER)) {
    error_log('Afstor website enquiry email failed to send (' . $audience . ').');
    respond(503, false, 'We could not send your enquiry right now. Please call or WhatsApp us on +254 181 100 200.');
}

$_SESSION['afstor_contact_last_submission'] = $now;
session_write_close();
respond(200, true, 'Your enquiry has reached our ' . strtolower($route['team']) . ' team. We will be in touch soon.');
