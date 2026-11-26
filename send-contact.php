<?php
declare(strict_types=1);

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
    respond(413, false, 'Your inquiry is too long. Please shorten it and try again.');
}

$rawBody = file_get_contents('php://input', false, null, 0, 16001);
if ($rawBody === false || strlen($rawBody) > 16000) {
    respond(413, false, 'Your inquiry is too long. Please shorten it and try again.');
}

$payload = json_decode($rawBody, true);
if (!is_array($payload)) {
    respond(400, false, 'The form data could not be read. Please refresh the page and try again.');
}

$website = cleanSingleLine($payload['website'] ?? '', 200);
if ($website === null || $website !== '') {
    respond(422, false, 'We could not process this submission. Please try again.');
}

$name = cleanSingleLine($payload['name'] ?? null, 120);
if ($name === null || strlen($name) < 2) {
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

$requestType = cleanSingleLine($payload['request_type'] ?? null, 60);
$allowedRequestTypes = [
    'Product demonstration',
    'Product or service inquiry',
    'Partnership',
    'Bulk or institutional order',
    'Customer support',
    'Other'
];
if ($requestType === null || !in_array($requestType, $allowedRequestTypes, true)) {
    respond(422, false, 'Choose what you need from the inquiry list.');
}

$product = cleanSingleLine($payload['product_interest'] ?? 'Not sure yet', 60);
$allowedProducts = ['Not sure yet', '450W Solar Panels', 'Solar-Induction Cooking System'];
if ($product === null || !in_array($product, $allowedProducts, true)) {
    respond(422, false, 'Choose a listed product or select “Not sure yet”.');
}

$requirements = $payload['message'] ?? null;
if (!is_string($requirements)) {
    respond(422, false, 'Describe your requirements before sending.');
}

$requirements = str_replace(["\r\n", "\r"], "\n", trim($requirements));
$requirements = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $requirements);
if ($requirements === null || textLength($requirements) < 10 || textLength($requirements) > 3000) {
    respond(422, false, 'Describe your requirements in 10 to 3000 characters.');
}

if (session_status() !== PHP_SESSION_ACTIVE && !session_start()) {
    respond(503, false, 'We could not process your inquiry right now. Please try again later.');
}

$now = time();
$lastSubmission = (int) ($_SESSION['afstor_contact_last_submission'] ?? 0);
if ($lastSubmission > 0 && $now - $lastSubmission < 20) {
    respond(429, false, 'Please wait a moment before sending another inquiry.');
}

$recipient = 'office@afstor.com';
$sender = 'noreply@afstor.co.ke';
$subject = '[Afstor Website] ' . $requestType;
$body = implode("\n", [
    'New inquiry from the Afstor website',
    '',
    'Inquiry type: ' . $requestType,
    'Product or service: ' . $product,
    'Name: ' . $name,
    'Email: ' . $email,
    'Phone: ' . ($phone !== '' ? $phone : 'Not provided'),
    '',
    'Requirements:',
    $requirements
]);
$headers = implode("\r\n", [
    'From: Afstor Website <' . $sender . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'X-Mailer: PHP/' . PHP_VERSION
]);

if (!mail($recipient, $subject, $body, $headers, '-f' . $sender)) {
    error_log('Afstor website contact email failed to send.');
    respond(503, false, 'We could not send your inquiry right now. Please try again or contact us directly.');
}

$_SESSION['afstor_contact_last_submission'] = $now;
session_write_close();
respond(200, true, 'Your inquiry has been sent. We will be in touch soon.');
