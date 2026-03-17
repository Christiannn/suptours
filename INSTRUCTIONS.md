# GOAL:
SUP - Stand Up Paddle - Tours.
Engaging userfriendly web app, mobile first, for finding, planning, joining, sharing and following SUP adventures and trips.
Based on A Svelte 5 + SvelteKit + Supabase - CRUD and TEAM/USER management Base Web Application. Ready to be enganced, designed upon, and then deployed.

# BASE APPLICATION DESIGN
- Layout: Minimal frontpage with logo in top left, top right nav menu, left sidebar (context menu), slim footer. Main area with sections, each section have {custom no.} columns layout. Full height and fill width. Not scroll unless contex like images and text is larger than viewport.
- Home page section 1: Welcome - big title and image - Large "Call to Action" btn "sign-up". (opens register page from auth user onboarding flow forms)
- Home page section 2: Blog posts (displayed as 3 cards in one row, with a "read more..." link that opens in /blog/{blog-title})
- Home page section 3: Get newsletter form: (anonymus supabase user signup for newsletter)
- Functions: top menu > user auth flow (signup - login - logout - user profile page CRUD) according to user session states.
- Function: Tenants url: /Team - create team > add users to team (via emails) > give them roles: participant(read and comment) - editor (create-edit-read ect. - delete own blogs) - super (all - and delete all blogs on tenant)
- Function: BLOG (example supabase CRUD flow - create > edit > read > delete blog posts, saved in Supabase db with RLS for CRUD operations, except read, locked to signed in user or team member, read is for anonymus users.)
- Function: Chat bot, small cornor - bottom right - chat action on frontpage - opens small modal - context aware to help guide user - saves chat conversation in browser - use realtime API from supabase so website support agent can talk to user "live".
- Footer Function: Cookie concent banner - be default very simple since NO ADVERTISEMENT data sharing active. Only "save anononymys use data to supabase, not shared with 3. party. (isolated lib/shared components)
- Footer function: Donate with "By me coffe". (isolated in lib/Shared components)


# REQUIREMENTS FOR ALL CODE:
1. The repo must force clean Svelte 5 best practice, using Svelte MCP
2. And It must force clean Supabase best practice, using Supabase MCP
3. Use as few JS and node dependencies as possible, its better to write our own custom and isolated Svelte 5 lib utilities
4. Try using as much W3C web standards as possible in HTML and CSS parts of Svelte components and pages. NO CSS framework must be introduced, only standard CSS with CSS variables for central font, border, color and corner and animations control.
5. UI and navigation and layout, must me simple, clean and minilist. 
Actions and forms placed in own pages, like /signup and /login, with redirect back to origin after submit. And /blog/edit (new blog) and edit of blogs posts in (/edit/[blog-title]) ect.
In general, its not a SPA, but multi page application with server loads, SRR, And with Svelte Runes to keep everything up to date in front-end (! dont use "effect()" all over, keep it to bare minimum.)
5. THEME: Use a theme css file for central control of style and colors ect. and use a base.css to controll basis css.
Other css must be placed in components and pages and layout ect, according to svelte best practice.


# Available MCP Tools:
1. Svelte MCP server
2. Supabase MCP server

## Svelte MCP server
You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant and up to date best practices.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

## Supabase MCP server:
There are over 20 tools available in the Supabase MCP server.

You can:
Design tables and track them using migrations
Fetch data and run reports using SQL queries
Create database branches for development (experimental)
Fetch project configuration
Pause and restore projects
Retrieve logs to debug issues
Generate TypeScript types ( use "npm run types") run it often.
