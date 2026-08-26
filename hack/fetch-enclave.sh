#!/usr/bin/env bash
# Clones enclave at ENCLAVE_VERSION (branch, tag, or commit SHA), applies
# wizard-specific overrides from hack/enclave/, and packages it as a tarball
# for hack/deploy-wizard to ship to the target VM. Cloning happens on the
# machine running this script (not the VM), so the deploy works even when
# the target lab network has no outbound access to GitHub.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT_DIR="${REPO_DIR}/out"
OVERRIDES_DIR="${REPO_DIR}/hack/enclave"

ENCLAVE_REPO="${ENCLAVE_REPO:-https://github.com/rh-ecosystem-edge/enclave.git}"
ENCLAVE_VERSION="${ENCLAVE_VERSION:-main}"

echo "=== Fetching enclave (${ENCLAVE_VERSION}) ==="
echo "  Repo: ${ENCLAVE_REPO}"

ENCLAVE_TMP=$(mktemp -d)
trap 'rm -rf "${ENCLAVE_TMP}"' EXIT

echo "[1/3] Cloning..."
git clone --quiet "${ENCLAVE_REPO}" "${ENCLAVE_TMP}/enclave"
git -C "${ENCLAVE_TMP}/enclave" checkout --quiet "${ENCLAVE_VERSION}"
RESOLVED_SHA=$(git -C "${ENCLAVE_TMP}/enclave" rev-parse --short HEAD)
echo "  Resolved to ${RESOLVED_SHA}"

if [ -d "${OVERRIDES_DIR}" ]; then
  echo "[2/3] Applying overrides from hack/enclave/..."
  cp -rv "${OVERRIDES_DIR}/." "${ENCLAVE_TMP}/enclave/" | tail -5
else
  echo "[2/3] No overrides at hack/enclave/ — skipping"
fi

echo "[3/3] Packaging..."
mkdir -p "${OUT_DIR}"
TARBALL="${OUT_DIR}/enclave-repo.tar.gz"
tar czf "${TARBALL}" -C "${ENCLAVE_TMP}" enclave

echo ""
echo "  ${TARBALL} (enclave @ ${RESOLVED_SHA})"
