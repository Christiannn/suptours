/**
 * Local dev: create fixed admin + test users via GoTrue Admin API (no raw auth.users SQL).
 * Profiles come from handle_new_user; we set is_admin on the admin profile afterward.
 *
 * Requires .env: PUBLIC_SUPABASE_URL or SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';

// GoTrue rejects all-zero UUID; keep stable for seed-data.sql + FKs
const ADMIN_ID = 'a0000000-0000-4000-8000-000000000001';
const TEST_ID = 'b2e3f4a5-6c7d-8e9f-0a1b-2c3d4e5f6078';

const ADMIN_EMAIL = 'admin@suptours.dk';
const ADMIN_PASSWORD = 'password';
const TEST_EMAIL = 'test@suptour.dk';
const TEST_PASSWORD = 'Husk1234';

const url = process.env.PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
	console.error(
		'seed-dev-test-user: set PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env',
	);
	process.exit(1);
}

const admin = createClient(url, serviceKey, {
	auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * @param {{ id: string, email: string, password: string, user_metadata: Record<string, unknown> }} u
 */
async function upsertDevUser(u) {
	const { error: updateErr } = await admin.auth.admin.updateUserById(u.id, {
		password: u.password,
		email_confirm: true,
		user_metadata: u.user_metadata,
	});

	if (!updateErr) {
		console.log('seed-dev-test-user: updated', u.email);
		return;
	}

	const msg = String(updateErr.message ?? '').toLowerCase();
	const missing =
		msg.includes('not found') ||
		msg.includes('user not found') ||
		msg.includes('loading user') ||
		updateErr.status === 404;

	if (!missing) {
		throw new Error(`updateUser ${u.email}: ${updateErr.message}`);
	}

	const { error: cErr } = await admin.auth.admin.createUser({
		id: u.id,
		email: u.email,
		password: u.password,
		email_confirm: true,
		user_metadata: u.user_metadata,
	});
	if (cErr) throw new Error(`createUser ${u.email}: ${cErr.message}`);
	console.log('seed-dev-test-user: created', u.email);
}

await upsertDevUser({
	id: ADMIN_ID,
	email: ADMIN_EMAIL,
	password: ADMIN_PASSWORD,
	user_metadata: { display_name: 'Admin User' },
});

await upsertDevUser({
	id: TEST_ID,
	email: TEST_EMAIL,
	password: TEST_PASSWORD,
	user_metadata: { display_name: 'Test Paddler' },
});

const { error: adminProfileErr } = await admin
	.from('profiles')
	.update({ is_admin: true })
	.eq('id', ADMIN_ID);

if (adminProfileErr) {
	console.error('seed-dev-test-user: could not set profiles.is_admin:', adminProfileErr.message);
	process.exit(1);
}

const { error: nameErr } = await admin
	.from('profiles')
	.update({ display_name: 'Test Paddler' })
	.eq('id', TEST_ID);

if (nameErr) {
	console.error('seed-dev-test-user: could not set test display_name:', nameErr.message);
	process.exit(1);
}

console.log(
	'seed-dev-test-user: OK — admin',
	ADMIN_EMAIL,
	'/',
	ADMIN_PASSWORD,
	'| test',
	TEST_EMAIL,
	'/',
	TEST_PASSWORD,
);
