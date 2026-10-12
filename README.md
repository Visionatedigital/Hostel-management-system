# Hostel-management-system
# Hostel-management-system

### Announcement AI rewriting

Admins can draft an announcement, choose Formal management notice, Friendly or Short & clear,
and preview an OpenAI rewrite before applying it. Applying a suggestion keeps an
undo option; rewriting never publishes an announcement.

Copy `server/.env.example` to `server/.env` and set `OPENAI_API_KEY`.
`OPENAI_REWRITE_MODEL` defaults to `gpt-4.1-mini`. Restart the server after changing
environment variables. The key stays on the server and `.env` is ignored by Git.

Only the draft title, body, audience and style are submitted to OpenAI's Responses
API, with `store: false`. Drafts are limited to 6,000 characters; requests time out
after 25 seconds and are limited to 20 rewrites per admin per five minutes per
server process. Provider failures leave the draft intact.

Custom announcement audiences can include selected resident records and staff accounts.
Management can create, edit, archive and restore groups. Custom announcements capture
the recipient list and audience name when posted; later group changes do not change
access to earlier notices. Recipients see their notices in the app and notification menu.
The formal rewrite expands rough notes into a complete management notice with an
appropriate greeting, apology for disruptions, thanks and closing, without adding facts.

### EgoSMS and guest gate codes

Residents must provide a valid guest phone number when creating an invitation. After the guest accepts with a selfie and ID photo, the server generates a unique six-digit access code, shows it on the acceptance page, and sends it to the guest through EgoSMS. Security enters that code in the visitor review screen; verification happens on the server, and approving the guest checks them in. Five incorrect attempts from the same address are allowed per visitor in a 15-minute window. SMS failure does not invalidate an accepted invitation because the on-screen code remains available through the private invitation link.

Admins can also choose **Send SMS** on a posted announcement, review recipients, and submit the message through the same EgoSMS integration. Uganda local phone numbers are normalized to +256; international numbers are validated. Missing, invalid, and duplicate numbers are handled before sending.

Configure these in the private, Git-ignored server/.env (see server/.env.example):

- EGOSMS_ENVIRONMENT: sandbox or live.
- EGOSMS_USERNAME: API username from EgoSMS Settings > API Settings.
- EGOSMS_PASSWORD: matching API password; server only.
- EGOSMS_SENDER_ID: sender ID configured and approved in the EgoSMS account.

Sandbox requests use https://comms-test.pahappa.net/api/v1/json/; live requests use https://comms.egosms.co/api/v1/json/. Restart the backend after changing environment values. The Settings connection check uses EgoSMS's Balance method and sends no SMS.

Announcement reviews expire after 30 minutes, freeze the reviewed text and numbers, and remain single-use after submission. EgoSMS acceptance is not handset delivery; use the provider dashboard and follow-up reference for final delivery status. No automatic retries are made after uncertain provider responses.

Provider reference: [official EgoSMS/Pahappa Comms API documentation](https://developers.pahappa.com/docs/sending-sms/api-specs-and-usage/).
### Reports and settings

The admin **Finance & Services → Reports** page provides month/room filters, monthly rent allocation, invoice amounts due in the selected month, actual dated receipts, and unpaid invoices due by the report date. Six-month trends, tenant-category totals, payment-method totals, invoice aging and room occupancy support reconciliation. Historical balances exclude receipts dated after the report date. Future periods are labelled scheduled/forecast values. Available-bed occupancy excludes rooms under maintenance. Manual/legacy payments, deposits and expenses remain separate; the reports are not profit statements.

Export the selected table (unpaid balances, receipts, rent allocation, or room occupancy) as a UTF-8 CSV, or use **Print report** for a branded print layout. CSV text fields neutralize spreadsheet formulas. Access and exports are admin-only.

**Administration → Settings** saves hostel details and report contact/footer information in SQLite. New Dashboard stay forms use the saved tenant-category and rent-basis defaults; Dashboard receipts use the saved payment method. Existing financial records are unaffected. Semester duration (three months), full-calendar-month charging, UGX and Africa/Kampala remain the agreed fixed rules. Profile edits update only the signed-in admin's name/phone; they cannot change roles or credentials.

Integration status exposes configuration flags and non-secret model/sender information. **Check SMS connection** queries the EgoSMS local wallet balance and never sends a message. Provider secrets remain in the private server environment; restart after changing them.
