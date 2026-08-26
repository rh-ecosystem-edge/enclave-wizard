#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUT_DIR="${REPO_DIR}/out"

echo "=== Building Enclave Wizard RPM ==="

# --- Build enclave-wizard RPM ---
# Expects the wizard binary (with embedded UI) to already be built — the
# `rpm` Makefile target has `build-linux` as a prerequisite for this.
echo ""
echo "[1/2] Building enclave-wizard RPM..."
mkdir -p "${OUT_DIR}"

podman run --rm \
    -v "${REPO_DIR}:/src:z" \
    -v "${OUT_DIR}:/out:z" \
    -w /src \
    fedora:latest \
    bash -c '
        set -e
        dnf install -y rpm-build 2>/dev/null | tail -1

        RPMBUILD_DIR=$(mktemp -d)
        mkdir -p ${RPMBUILD_DIR}/{SOURCES,SPECS,RPMS,BUILD,SRPMS}

        cp /src/enclave-wizard                          ${RPMBUILD_DIR}/SOURCES/enclave-wizard
        cp /src/hack/systemd/enclave-wizard.service     ${RPMBUILD_DIR}/SOURCES/enclave-wizard.service
        cp /src/hack/rpm/enclave-wizard.spec             ${RPMBUILD_DIR}/SPECS/

        rpmbuild -bb \
            --define "_topdir ${RPMBUILD_DIR}" \
            ${RPMBUILD_DIR}/SPECS/enclave-wizard.spec

        cp ${RPMBUILD_DIR}/RPMS/*/*.rpm /out/
        rm -rf ${RPMBUILD_DIR}
    '

# --- Generate checksums ---
echo "[2/2] Done."
for rpm in "${OUT_DIR}/"enclave-wizard-*.rpm; do
    sha256sum "${rpm}" > "${rpm}.sha256"
done

echo ""
ls -lh "${OUT_DIR}/"enclave-wizard-*.rpm
