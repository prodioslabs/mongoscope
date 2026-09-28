#!/usr/bin/env bash

# Must run before bash-only `set -o pipefail` so `curl … | sh` fails clearly.
[ -n "${BASH_VERSION:-}" ] || {
	echo "mongoscope installer: run with bash (e.g. curl … | bash)" >&2
	exit 1
}

set -euo pipefail

REPOSITORY="prodioslabs/mongoscope"
VERSION="${MONGOSCOPE_VERSION:-latest}"

fail() {
	printf 'mongoscope installer: %s\n' "$*" >&2
	exit 1
}

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v tar >/dev/null 2>&1 || fail "tar is required"

case "$(uname -s)" in
	Linux)
		os="linux"
		;;
	Darwin)
		os="darwin"
		;;
	*)
		fail "unsupported OS: $(uname -s) (Linux and macOS only; download a Windows build from https://github.com/${REPOSITORY}/releases)"
		;;
esac

case "$(uname -m)" in
	x86_64 | amd64)
		arch="amd64"
		;;
	aarch64 | arm64)
		arch="arm64"
		;;
	*)
		fail "unsupported architecture: $(uname -m)"
		;;
esac

# Prefer the invoking user's home when the installer itself runs under sudo.
install_home=${HOME:-}
if [ "$(id -u)" -eq 0 ] && [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
	sudo_home=$(eval echo "~$SUDO_USER" 2>/dev/null || true)
	[ -n "$sudo_home" ] && [ "$sudo_home" != "~$SUDO_USER" ] && install_home=$sudo_home
fi
[ -n "$install_home" ] || fail "HOME is unset"

# Linux keeps /usr/local (typically needs sudo). macOS defaults to a
# user-writable prefix so the installer runs without sudo.
if [ -n "${MONGOSCOPE_PREFIX:-}" ]; then
	PREFIX=$MONGOSCOPE_PREFIX
elif [ "$os" = "darwin" ]; then
	PREFIX="$install_home/.local"
else
	PREFIX=/usr/local
fi

if [ "$VERSION" = "latest" ]; then
	printf 'Resolving latest mongoscope release...\n'
	# Prefer GitHub's latest redirect — avoids API rate limits.
	VERSION=$(
		curl -fsSLI -o /dev/null -w '%{url_effective}' \
			"https://github.com/${REPOSITORY}/releases/latest"
	)
	VERSION=${VERSION%/}
	VERSION=${VERSION##*/}
	[ -n "$VERSION" ] || fail "could not resolve latest release tag"
fi

case "$VERSION" in
	v*)
		release_version=${VERSION#v}
		;;
	*)
		release_version=$VERSION
		VERSION="v$VERSION"
		;;
esac

release_url="https://github.com/${REPOSITORY}/releases/download/${VERSION}"
tmp_dir=$(mktemp -d 2>/dev/null || mktemp -d -t mongoscope-install)
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM

host_dir="$tmp_dir/host"
mkdir -p "$host_dir"

verify_archive() {
	archive=$1
	dir=$2

	expected_checksum=$(
		awk -v archive="$archive" '$2 == archive || $2 == "*" archive { print $1; exit }' \
			"$tmp_dir/checksums.txt"
	)
	[ -n "$expected_checksum" ] || fail "checksum for $archive was not found"

	if command -v sha256sum >/dev/null 2>&1; then
		actual_checksum=$(sha256sum "$dir/$archive" | awk '{print $1}')
	elif command -v shasum >/dev/null 2>&1; then
		actual_checksum=$(shasum -a 256 "$dir/$archive" | awk '{print $1}')
	else
		fail "sha256sum or shasum is required"
	fi

	[ "$actual_checksum" = "$expected_checksum" ] ||
		fail "checksum verification failed for $archive"
}

host_archive="mongoscope_${release_version}_${os}_${arch}.tar.gz"

printf 'Fetching checksums for mongoscope %s...\n' "$VERSION"
curl -fsSL --retry 3 -o "$tmp_dir/checksums.txt" "$release_url/checksums.txt"

printf 'Downloading mongoscope %s for %s/%s...\n' "$VERSION" "$os" "$arch"
curl -fsSL --retry 3 -o "$host_dir/$host_archive" "$release_url/$host_archive"
verify_archive "$host_archive" "$host_dir"
tar -xzf "$host_dir/$host_archive" -C "$host_dir"

[ -f "$host_dir/mongoscope" ] || fail "mongoscope binary is missing from the $os/$arch release archive"

if [ "$(id -u)" -eq 0 ]; then
	sudo_cmd=""
elif mkdir -p "$PREFIX/bin" 2>/dev/null && [ -w "$PREFIX/bin" ]; then
	sudo_cmd=""
elif command -v sudo >/dev/null 2>&1; then
	sudo_cmd="sudo"
else
	fail "run as root, install sudo, or set MONGOSCOPE_PREFIX to a writable directory"
fi

$sudo_cmd install -d "$PREFIX/bin"
# Atomic-ish install into place (temp download already verified; install(1) replaces the destination).
$sudo_cmd install -m 755 "$host_dir/mongoscope" "$PREFIX/bin/mongoscope"

printf '\nMongoScope %s installed to %s/bin/mongoscope\n' "$VERSION" "$PREFIX"

case ":$PATH:" in
	*"$PREFIX/bin"*) ;;
	*)
		printf 'Warning: %s/bin is not on PATH; add it so mongoscope is found.\n' "$PREFIX"
		;;
esac

if ! "$PREFIX/bin/mongoscope" --version >/dev/null 2>&1; then
	fail "installed binary failed: $PREFIX/bin/mongoscope --version"
fi

printf 'Verified: '
"$PREFIX/bin/mongoscope" --version
printf '\n'
