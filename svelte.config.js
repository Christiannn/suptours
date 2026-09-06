import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// adapter-node produces `build/index.js`, a standalone Node server.
		// Run it behind Caddy with ORIGIN/PORT/HOST set — see deploy/README.md.
		adapter: adapter()
	}
};

export default config;
