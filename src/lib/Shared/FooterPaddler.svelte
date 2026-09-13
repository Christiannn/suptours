<script lang="ts">
	import { onMount } from 'svelte';

	// Client-side animation frame loop control
	let isClient = $state(false);

	// Simple state variables updated sequentially in the animation loop
	let boardX = $state(-100);
	let boardYOffset = $state(0);
	let boardAngle = $state(0);

	let blade = $state({ x: 24, y: 80 });
	let g1 = $state({ x: -1, y: 17 });
	let g2 = $state({ x: 10.5, y: 46 });
	let shaftAngle = $state(-21.6);

	let hipX = $state(-3.7);
	let hipY = $state(54);
	let shoulder = $state({ x: -10.9, y: 31.1 });
	let head = $state({ x: -13.1, y: 23.9 });

	let topElbow = $state({ jointX: -12.9, jointY: 17.3 });
	let bottomElbow = $state({ jointX: -2.1, jointY: 39.9 });

	// Fixed foot placements on board (in board-local space)
	const backFoot = { x: -14, y: 78 };
	const frontFoot = { x: 8, y: 78 };

	let backKnee = $state({ jointX: -8.4, jointY: 65 });
	let frontKnee = $state({ jointX: 1.6, jointY: 64.7 });

	interface Ripple {
		x: number;
		y: number;
		rx: number;
		ry: number;
		opacity: number;
	}
	let ripples = $state<Ripple[]>([]);
	let splash = $state({ opacity: 0, rx: 0, ry: 0, x: 0, y: 0 });

	// 2D Inverse Kinematics solver using law of cosines
	function solveIK(
		startX: number,
		startY: number,
		endX: number,
		endY: number,
		len1: number,
		len2: number,
		flip: number
	) {
		const dx = endX - startX;
		const dy = endY - startY;
		const dist = Math.sqrt(dx * dx + dy * dy);

		// If target is out of reach or overlap, fully extend towards it
		if (dist >= len1 + len2 || dist === 0) {
			const angle = dist === 0 ? 0 : Math.atan2(dy, dx);
			return {
				jointX: startX + Math.cos(angle) * len1,
				jointY: startY + Math.sin(angle) * len1
			};
		}

		const a = len1;
		const b = len2;
		const c = dist;

		// Law of cosines: cos(A) = (a^2 + c^2 - b^2) / (2 * a * c)
		let cosA = (a * a + c * c - b * b) / (2 * a * c);
		cosA = Math.max(-1, Math.min(1, cosA)); // clamp
		const A = Math.acos(cosA);

		const baseAngle = Math.atan2(dy, dx);
		const elbowAngle = baseAngle + flip * A;

		return {
			jointX: startX + Math.cos(elbowAngle) * len1,
			jointY: startY + Math.sin(elbowAngle) * len1
		};
	}

	onMount(() => {
		isClient = true;
		let frame: number;
		const start = performance.now();

		const PADDLE_CYCLE = 2.8; // seconds per stroke
		const MOVE_CYCLE = 22.0;   // seconds to cross the screen

		function update() {
			const time = (performance.now() - start) / 1000;

			// 1. Board movement & wave oscillation
			const moveProgress = (time % MOVE_CYCLE) / MOVE_CYCLE;
			boardX = -100 + moveProgress * 1400;
			boardYOffset = Math.sin(time * 3.5) * 1.8;
			boardAngle = Math.sin(time * 3.5 - 0.7) * 2.2;

			// 2. Stroke phase (0 to 2*PI)
			const strokePhase = ((time % PADDLE_CYCLE) / PADDLE_CYCLE) * 2 * Math.PI;
			const isPower = strokePhase < Math.PI;

			// 3. Paddle blade path (elliptical stroke trajectory)
			let bx = 0, by = 0;
			if (isPower) {
				const p = strokePhase / Math.PI;
				bx = 24 - 38 * p;
				by = 80 + 7 * Math.sin(p * Math.PI); // deep stroke in water
			} else {
				const p = (strokePhase - Math.PI) / Math.PI;
				bx = -14 + 38 * p;
				by = 74 - 18 * Math.sin(p * Math.PI); // high swing in air
			}
			blade = { x: bx, y: by };

			// 4. Top grip G1
			let g1x = 0, g1y = 0;
			if (isPower) {
				const p = strokePhase / Math.PI;
				g1x = -1 + 8 * Math.sin(p * Math.PI / 2);
				g1y = 17 + 5 * p;
			} else {
				const p = (strokePhase - Math.PI) / Math.PI;
				g1x = 7 - 8 * p;
				g1y = 22 - 5 * p;
			}
			g1 = { x: g1x, y: g1y };

			// 5. Bottom grip G2
			g2 = {
				x: g1x + (bx - g1x) * 0.46,
				y: g1y + (by - g1y) * 0.46
			};

			// Shaft angle (for rotating the blade ellipse)
			shaftAngle = Math.atan2(by - g1y, bx - g1x) * 180 / Math.PI - 90;

			// 6. Hips, Torso, Shoulders, Head
			const hX = -3 + Math.sin(strokePhase - 0.5) * 1.5;
			const hY = 53 + Math.cos(strokePhase) * 1.0;
			hipX = hX;
			hipY = hY;

			const lean = -11 + Math.sin(strokePhase - 0.8) * 9;
			const rad = (lean * Math.PI) / 180;
			
			const shX = hX + Math.sin(rad) * 24;
			const shY = hY - Math.cos(rad) * 24;
			shoulder = { x: shX, y: shY };

			head = {
				x: shX + Math.sin(rad) * 7.5,
				y: shY - Math.cos(rad) * 7.5
			};

			// 7. Leg and Arm IK
			topElbow = solveIK(shX, shY - 2, g1x, g1y, 12, 12, -1);
			bottomElbow = solveIK(shX, shY - 2, g2.x, g2.y, 14, 14, 1);

			backKnee = solveIK(hX, hY, backFoot.x, backFoot.y, 12, 12, 1);
			frontKnee = solveIK(hX, hY, frontFoot.x, frontFoot.y, 12, 12, 1);

			// 8. Wake ripples behind the board
			const tempRipples = [];
			for (let i = 0; i < 3; i++) {
				const phaseOffset = (time + i * 0.8) % 2.4;
				const scale = phaseOffset / 2.4;
				const distance = 40 + scale * 50;
				const rx = 10 + scale * 25;
				const ry = 2 + scale * 4;
				const opacity = 0.5 * (1 - scale);
				tempRipples.push({
					x: boardX - distance,
					y: 78 + boardYOffset + 4,
					rx,
					ry,
					opacity
				});
			}
			ripples = tempRipples;

			// 9. Splash at water entry (catch)
			const splashActive = strokePhase > 0 && strokePhase < 0.6;
			if (splashActive) {
				const scale = strokePhase / 0.6;
				splash = {
					x: boardX + 24,
					y: 80 + boardYOffset,
					rx: scale * 12,
					ry: scale * 4,
					opacity: 0.6 * (1 - scale)
				};
			} else {
				splash = { opacity: 0, rx: 0, ry: 0, x: 0, y: 0 };
			}

			frame = requestAnimationFrame(update);
		}

		frame = requestAnimationFrame(update);
		return () => cancelAnimationFrame(frame);
	});
</script>

<div class="footer-paddler" aria-hidden="true">
	<svg
		class="footer-paddler__scene"
		viewBox="0 0 1200 110"
		preserveAspectRatio="xMidYMax meet"
		xmlns="http://www.w3.org/2000/svg"
	>
		<!-- Wave layer deep (back) -->
		<path class="wave wave--deep" d="M0 60 C100 45,200 75,300 60 S500 45,600 60 S800 75,900 60 S1100 45,1200 60 L1200 110 L0 110 Z"/>
		
		<!-- Trailing Wake Ripples -->
		{#if isClient}
			{#each ripples as r, i (i)}
				<ellipse
					cx={r.x}
					cy={r.y}
					rx={r.rx}
					ry={r.ry}
					class="paddler__wake"
					style="opacity: {r.opacity}"
				/>
			{/each}
		{/if}

		<!-- Wave layer mid -->
		<path class="wave wave--mid" d="M0 72 C120 58,240 86,360 72 S600 58,720 72 S960 86,1080 72 S1200 58,1200 72 L1200 110 L0 110 Z"/>

		{#if !isClient}
			<!-- Static SSR Fallback positioned in center -->
			<g class="paddler-group fallback" transform="translate(560, 0)">
				<!-- Board -->
				<rect class="paddler__board" x="-44" y="78" width="88" height="6" rx="3"/>
				<path class="paddler__board" d="M20 84 L25 94 L13 94 Z"/>
				
				<!-- Legs -->
				<line class="paddler__legs" x1="-14" y1="78" x2="-8" y2="65" stroke-width="4.5" stroke-linecap="round"/>
				<line class="paddler__legs" x1="-8" y1="65" x2="-3" y2="53" stroke-width="4.5" stroke-linecap="round"/>
				<line class="paddler__legs" x1="8" y1="78" x2="3" y2="65" stroke-width="4.5" stroke-linecap="round"/>
				<line class="paddler__legs" x1="3" y1="65" x2="-3" y2="53" stroke-width="4.5" stroke-linecap="round"/>

				<!-- Body (Hips to Shoulder) -->
				<line class="paddler__torso-line" x1="-3" y1="53" x2="-8" y2="28" stroke-width="8.5" stroke-linecap="round"/>
				<!-- Head -->
				<circle class="paddler__head" cx="-10" cy="18" r="7.5"/>

				<!-- Arms -->
				<!-- Top Arm (Shoulder to G1) -->
				<line class="paddler__arm" x1="-8" y1="28" x2="-14" y2="22" stroke-width="4.5" stroke-linecap="round"/>
				<line class="paddler__arm" x1="-14" y1="22" x2="-10" y2="18" stroke-width="4" stroke-linecap="round"/>
				<!-- Bottom Arm (Shoulder to G2) -->
				<line class="paddler__arm" x1="-8" y1="28" x2="3" y2="40" stroke-width="4.5" stroke-linecap="round"/>
				<line class="paddler__arm" x1="3" y1="40" x2="5" y2="48" stroke-width="4" stroke-linecap="round"/>

				<!-- Paddle -->
				<line class="paddler__shaft" x1="-10" y1="18" x2="22" y2="80" stroke-width="3" stroke-linecap="round"/>
				<ellipse class="paddler__blade" cx="24" cy="84" rx="6" ry="10" transform="rotate(30, 24, 84)"/>
			</g>
		{:else}
			<!-- Dynamic Client-Side Animated Paddler -->
			<g class="paddler-group" transform="translate({boardX}, {boardYOffset}) rotate({boardAngle}, 0, 78)">
				<!-- Board -->
				<rect class="paddler__board" x="-44" y="78" width="88" height="6" rx="3"/>
				<!-- Fin -->
				<path class="paddler__board" d="M20 84 L25 94 L13 94 Z"/>

				<!-- Legs (IK Bending) -->
				<!-- Back Leg -->
				<line class="paddler__legs" x1={backFoot.x} y1={backFoot.y} x2={backKnee.jointX} y2={backKnee.jointY} stroke-width="5.2" stroke-linecap="round"/>
				<line class="paddler__legs" x1={backKnee.jointX} y1={backKnee.jointY} x2={hipX} y2={hipY} stroke-width="5.2" stroke-linecap="round"/>

				<!-- Front Leg -->
				<line class="paddler__legs" x1={frontFoot.x} y1={frontFoot.y} x2={frontKnee.jointX} y2={frontKnee.jointY} stroke-width="5.2" stroke-linecap="round"/>
				<line class="paddler__legs" x1={frontKnee.jointX} y1={frontKnee.jointY} x2={hipX} y2={hipY} stroke-width="5.2" stroke-linecap="round"/>

				<!-- Torso (smooth robust line) -->
				<line class="paddler__torso-line" x1={hipX} y1={hipY} x2={shoulder.x} y2={shoulder.y} stroke-width="9" stroke-linecap="round"/>

				<!-- Head -->
				<circle class="paddler__head" cx={head.x} cy={head.y} r="8"/>

				<!-- Arms (IK Bending) -->
				<!-- Top Arm -->
				<line class="paddler__arm" x1={shoulder.x} y1={shoulder.y - 2} x2={topElbow.jointX} y2={topElbow.jointY} stroke-width="4.5" stroke-linecap="round"/>
				<line class="paddler__arm" x1={topElbow.jointX} y1={topElbow.jointY} x2={g1.x} y2={g1.y} stroke-width="4" stroke-linecap="round"/>

				<!-- Bottom Arm -->
				<line class="paddler__arm" x1={shoulder.x} y1={shoulder.y - 2} x2={bottomElbow.jointX} y2={bottomElbow.jointY} stroke-width="4.5" stroke-linecap="round"/>
				<line class="paddler__arm" x1={bottomElbow.jointX} y1={bottomElbow.jointY} x2={g2.x} y2={g2.y} stroke-width="4" stroke-linecap="round"/>

				<!-- Paddle (always perfectly connected) -->
				<!-- Shaft -->
				<line class="paddler__shaft" x1={g1.x} y1={g1.y} x2={blade.x} y2={blade.y} stroke-width="3.2" stroke-linecap="round"/>
				<!-- T-Handle -->
				<line class="paddler__shaft" x1={g1.x - 4} y1={g1.y} x2={g1.x + 4} y2={g1.y} stroke-width="3.2" stroke-linecap="round" transform="rotate({shaftAngle}, {g1.x}, {g1.y})"/>
				<!-- Blade -->
				<ellipse
					class="paddler__blade"
					cx={blade.x}
					cy={blade.y + 3}
					rx="6.5"
					ry="10.5"
					transform="rotate({shaftAngle}, {blade.x}, {blade.y + 3})"
				/>
			</g>
		{/if}

		<!-- Wave layer front -->
		<path class="wave wave--front" d="M0 82 C140 70,280 94,420 82 S700 70,840 82 S1120 94,1200 82 L1200 110 L0 110 Z"/>

		<!-- Catch Splash Effect -->
		{#if isClient && splash.opacity > 0}
			<ellipse
				cx={splash.x}
				cy={splash.y}
				rx={splash.rx}
				ry={splash.ry}
				class="paddler__splash"
				style="opacity: {splash.opacity}"
			/>
			<circle cx={splash.x - splash.rx} cy={splash.y - splash.ry * 0.8} r="1.5" class="paddler__splash-drop" style="opacity: {splash.opacity}"/>
			<circle cx={splash.x + splash.rx} cy={splash.y - splash.ry * 0.8} r="1.5" class="paddler__splash-drop" style="opacity: {splash.opacity}"/>
		{/if}
	</svg>
</div>

<style>
	/* ---- Container ---- */
	.footer-paddler {
		width: 100%;
		overflow: hidden;
		line-height: 0;
		margin-top: 1.5rem;
		margin-bottom: -3.5rem;
	}

	.footer-paddler__scene {
		display: block;
		width: 100%;
		height: 110px;
	}

	/* ---- Waves — 3 shades of blue ---- */
	.wave { animation: wave-roll 6s ease-in-out infinite; }
	.wave--deep  { fill: #1e4d7a; animation-duration: 9s; animation-direction: alternate; opacity: 0.75; }
	.wave--mid   { fill: #2563a8; animation-duration: 7s; animation-direction: alternate-reverse; }
	.wave--front { fill: #38bdf8; animation-duration: 5s; opacity: 0.95; }

	@keyframes wave-roll {
		0%   { transform: translateX(0); }
		100% { transform: translateX(-80px); }
	}

	/* ---- Premium Custom Color Palette (Warm Sunset Highlights vs Cool Blue Waves) ---- */
	.paddler__board  { fill: #f8fafc; stroke: #cbd5e1; stroke-width: 1; }
	.paddler__torso-line { stroke: #f97316; fill: none; }
	.paddler__head   { fill: #ffedd5; stroke: #f97316; stroke-width: 1.5; }
	.paddler__arm    { stroke: #ffedd5; fill: none; }
	.paddler__shaft  { stroke: #475569; fill: none; }
	.paddler__blade  { fill: #f97316; }
	.paddler__legs   { stroke: #ea580c; fill: none; }

	/* ---- Micro-animations & Ripple Styling ---- */
	.paddler__wake {
		fill: none;
		stroke: #38bdf8;
		stroke-width: 1.5;
	}

	.paddler__splash {
		fill: none;
		stroke: #e0f2fe;
		stroke-width: 1.5;
	}

	.paddler__splash-drop {
		fill: #e0f2fe;
	}

	/* ---- Respect reduced motion ---- */
	@media (prefers-reduced-motion: reduce) {
		.wave { animation: none; }
	}
</style>
