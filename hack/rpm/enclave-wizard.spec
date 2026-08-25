Name:           enclave-wizard
Version:        0.0.1
Release:        1%{?dist}
Summary:        Install wizard for Red Hat Sovereign Enclave
License:        Apache-2.0
URL:            https://github.com/rh-ecosystem-edge/enclave-wizard

Source0:        enclave-wizard
Source1:        enclave-wizard.service

%description
Web-based install wizard for Red Hat Sovereign Enclave (RHSE).
Single binary that serves both the API and the embedded UI with TLS.
Requires the enclave package for schemas, playbooks, and runtime deps.

%install
install -D -m 0755 %{SOURCE0} %{buildroot}/usr/local/bin/enclave-wizard
install -D -m 0644 %{SOURCE1} %{buildroot}/etc/systemd/system/enclave-wizard.service

%post
# Open firewall ports
firewall-cmd --add-port=3001/tcp --permanent 2>/dev/null || true
firewall-cmd --add-port=3443/tcp --permanent 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true

# Start service
systemctl daemon-reload
systemctl enable --now enclave-wizard

echo ""
echo "Enclave Wizard installed and running."
echo "  UI:  https://$(hostname -f):3443/wizard"
echo "  (Self-signed cert — accept the browser warning)"
if [ -f /tmp/enclave-wizard-init-pass ]; then
    echo ""
    echo "  Admin password: $(cat /tmp/enclave-wizard-init-pass)"
    echo "  (You must change it on first login)"
    echo "  Check logs: journalctl -u enclave-wizard"
fi

%preun
if [ $1 -eq 0 ]; then
    systemctl stop enclave-wizard 2>/dev/null || true
    systemctl disable enclave-wizard 2>/dev/null || true
fi

%postun
if [ $1 -eq 0 ]; then
    systemctl daemon-reload
    firewall-cmd --remove-port=3001/tcp --permanent 2>/dev/null || true
    firewall-cmd --remove-port=3443/tcp --permanent 2>/dev/null || true
    rm -rf /etc/enclave-wizard/tls
    firewall-cmd --reload 2>/dev/null || true
fi

%files
/usr/local/bin/enclave-wizard
/etc/systemd/system/enclave-wizard.service
