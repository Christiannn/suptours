#!/usr/bin/env bash
#
# Points `current` back at the previous release and restarts. Deploys roll
# themselves back automatically on a failed health check; this is for the case
# where a deploy succeeded but the change turns out to be wrong.
#
#   rollback.sh            → previous release
#   rollback.sh <name>     → a specific release directory name
#
# Schema changes are forward-only and are NOT undone. Migrations must stay
# backward-compatible with the release before them for this to be safe.

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

require_not_root

mapfile -t releases < <(find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)
((${#releases[@]} >= 1)) || die "no releases in ${RELEASES_DIR}"

current="$(basename "$(readlink -f "${CURRENT_LINK}")")"

if [[ -n ${ARGS[0]:-} ]]; then
	target="${ARGS[0]}"
	[[ -d ${RELEASES_DIR}/${target} ]] || die "no such release: ${target}"
else
	target=""
	for release in "${releases[@]}"; do
		if [[ ${release} != "${current}" ]]; then
			target=${release}
			break
		fi
	done
	[[ -n ${target} ]] || die "no earlier release to roll back to (current: ${current})"
fi

log "Rolling back: ${current} → ${target}"
ln -sfn "${RELEASES_DIR}/${target}" "${CURRENT_LINK}.tmp"
mv -Tf "${CURRENT_LINK}.tmp" "${CURRENT_LINK}"
sudo systemctl restart "${APP_NAME}.service"

if wait_for_http "http://127.0.0.1:${APP_PORT}/healthz"; then
	ok "Rolled back to ${target}"
else
	die "${target} is also unhealthy — check: journalctl -u ${APP_NAME} -n 50"
fi
