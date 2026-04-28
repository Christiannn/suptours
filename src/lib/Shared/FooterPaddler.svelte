<div class="footer-paddler" aria-hidden="true">
	<svg
		class="footer-paddler__scene"
		viewBox="0 0 1200 110"
		preserveAspectRatio="xMidYMax meet"
		xmlns="http://www.w3.org/2000/svg"
	>
		<!-- Wave layer deep (back) -->
		<path class="wave wave--deep" d="M0 60 C100 45,200 75,300 60 S500 45,600 60 S800 75,900 60 S1100 45,1200 60 L1200 110 L0 110 Z"/>
		<!-- Wave layer mid -->
		<path class="wave wave--mid" d="M0 72 C120 58,240 86,360 72 S600 58,720 72 S960 86,1080 72 S1200 58,1200 72 L1200 110 L0 110 Z"/>
		<!-- Wave layer front -->
		<path class="wave wave--front" d="M0 82 C140 70,280 94,420 82 S700 70,840 82 S1120 94,1200 82 L1200 110 L0 110 Z"/>

		<!--
		  Paddler anatomy (Y coords within paddler-group):
		  Board top: y=78  Hip pivot: y=70
		  Torso: y=44→70  Shoulders: y=48  Head: cy=36 r=9
		  Nested groups use translate() so their pivot sits at local (0,0).
		-->
		<g class="paddler-group">
			<!-- Board -->
			<rect class="paddler__board" x="-44" y="78" width="88" height="6" rx="3"/>
			<!-- Fin -->
			<path class="paddler__board" d="M20 84 L25 94 L13 94 Z"/>
			<!-- Legs (splayed wide for stability) -->
			<line class="paddler__legs" x1="-5" y1="78" x2="-18" y2="85" stroke-width="5" stroke-linecap="round"/>
			<line class="paddler__legs" x1="5" y1="78" x2="16" y2="85" stroke-width="5" stroke-linecap="round"/>

			<!--
			  Body group — pivot at hip (0,70).
			  translate(0,70) puts hip at local (0,0) → CSS rotate acts on hip.
			-->
			<g class="paddler__body-group" transform="translate(0,70)">
				<!-- Torso: −26 to 0 in local Y -->
				<rect class="paddler__torso" x="-7" y="-26" width="14" height="26" rx="5"/>
				<!-- Head: −35 in local Y -->
				<circle class="paddler__head" cx="0" cy="-35" r="9"/>

				<!--
				  Paddle group — pivot at upper grip (0,−22) in body-group local space.
				  translate(0,−22) puts the grip at local (0,0).
				  Shaft runs from (0,−14) [T-handle] to (0,48) [blade end].
				-->
				<g class="paddler__paddle-group" transform="translate(0,-22)">
					<!-- Upper arm: shoulder → upper grip -->
					<line class="paddler__arm" x1="3" y1="-4" x2="0" y2="0" stroke-width="4" stroke-linecap="round"/>
					<!-- Lower arm: torso → mid-shaft grip -->
					<line class="paddler__arm" x1="5" y1="8" x2="0" y2="18" stroke-width="4" stroke-linecap="round"/>
					<!-- Paddle shaft -->
					<line class="paddler__shaft" x1="0" y1="-14" x2="0" y2="48" stroke-width="3" stroke-linecap="round"/>
					<!-- T-handle at top -->
					<line class="paddler__shaft" x1="-5" y1="-14" x2="5" y2="-14" stroke-width="3" stroke-linecap="round"/>
					<!-- Blade -->
					<ellipse class="paddler__blade" cx="0" cy="52" rx="7" ry="11"/>
				</g>
			</g>
		</g>
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

	/* ---- Paddler: sewing-machine travel across screen ---- */
	.paddler-group {
		animation: paddler-sewing 20s linear infinite;
	}

	@keyframes paddler-sewing {
		0%     { transform: translateX(-80px)  translateY(-9px)  rotate(-2deg); animation-timing-function: ease-in; }
		8.33%  { transform: translateX(33px)   translateY(13px)  rotate(3deg);  animation-timing-function: ease-out; }
		16.67% { transform: translateX(147px)  translateY(-9px)  rotate(-2deg); animation-timing-function: ease-in; }
		25%    { transform: translateX(260px)  translateY(13px)  rotate(3deg);  animation-timing-function: ease-out; }
		33.33% { transform: translateX(373px)  translateY(-9px)  rotate(-2deg); animation-timing-function: ease-in; }
		41.67% { transform: translateX(487px)  translateY(13px)  rotate(3deg);  animation-timing-function: ease-out; }
		50%    { transform: translateX(600px)  translateY(-9px)  rotate(-2deg); animation-timing-function: ease-in; }
		58.33% { transform: translateX(713px)  translateY(13px)  rotate(3deg);  animation-timing-function: ease-out; }
		66.67% { transform: translateX(827px)  translateY(-9px)  rotate(-2deg); animation-timing-function: ease-in; }
		75%    { transform: translateX(940px)  translateY(13px)  rotate(3deg);  animation-timing-function: ease-out; }
		83.33% { transform: translateX(1053px) translateY(-9px)  rotate(-2deg); animation-timing-function: ease-in; }
		91.67% { transform: translateX(1167px) translateY(13px)  rotate(3deg);  animation-timing-function: ease-out; }
		100%   { transform: translateX(1280px) translateY(-9px)  rotate(-2deg); }
	}

	/* ---- Body lean: pivots at hip (translate puts hip at local 0,0) ---- */
	.paddler__body-group {
		transform-origin: 0px 0px;
		animation: body-lean 3.33s ease-in-out infinite;
	}

	@keyframes body-lean {
		0%   { transform: rotate(0deg);   animation-timing-function: ease-in; }
		15%  { transform: rotate(-22deg); animation-timing-function: linear; }
		25%  { transform: rotate(-25deg); animation-timing-function: ease-out; }
		55%  { transform: rotate(-8deg);  animation-timing-function: ease-out; }
		70%  { transform: rotate(0deg);   animation-timing-function: ease-in; }
		85%  { transform: rotate(6deg);   animation-timing-function: ease-out; }
		100% { transform: rotate(0deg);   }
	}

	/* ---- Paddle stroke: pivots at upper grip (translate puts it at local 0,0) ---- */
	.paddler__paddle-group {
		transform-origin: 0px 0px;
		animation: paddle-stroke 3.33s ease-in-out infinite;
	}

	@keyframes paddle-stroke {
		0%   { transform: rotate(-52deg); animation-timing-function: ease-in; }
		20%  { transform: rotate(-50deg); animation-timing-function: linear; }
		60%  { transform: rotate(28deg);  animation-timing-function: ease-out; }
		72%  { transform: rotate(38deg);  animation-timing-function: ease-in; }
		88%  { transform: rotate(-45deg); animation-timing-function: ease-out; }
		100% { transform: rotate(-52deg); }
	}

	/* ---- Colours ---- */
	.paddler__board  { fill: #bfdbfe; }
	.paddler__torso  { fill: #7dd3fc; }
	.paddler__head   { fill: #7dd3fc; }
	.paddler__arm    { stroke: #93c5fd; fill: none; }
	.paddler__shaft  { stroke: #e0f2fe; fill: none; }
	.paddler__blade  { fill: #38bdf8; }
	.paddler__legs   { stroke: #93c5fd; fill: none; }

	/* ---- Respect reduced motion ---- */
	@media (prefers-reduced-motion: reduce) {
		.wave,
		.paddler-group,
		.paddler__body-group,
		.paddler__paddle-group { animation: none; }

		.paddler-group         { transform: translateX(560px) translateY(-9px) rotate(-2deg); }
		.paddler__paddle-group { transform: rotate(-20deg); }
	}
</style>
