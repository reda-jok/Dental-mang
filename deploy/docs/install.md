# Installing and updating a clinic server

The server is any 64-bit machine that stays on at the clinic, running Linux and Docker.
Which machine to use is still open (decision D1, on hold), so nothing here depends on it.
Devices (PCs, tablets, phones) open the app in a browser over the clinic's Wi-Fi.

## What you need

- The machine: Ubuntu 24.04 LTS (server or desktop), 4 GB of RAM or more, an SSD, wired
  to the clinic router.
- A **fixed address** on the clinic network, e.g. `192.168.1.10`: set a DHCP reservation
  for the machine in the router. Devices and the certificate use this address; if it
  changes, see "Changing the address" below.
- Internet during the install (Docker, Tailscale and the app image are downloaded). After
  that the clinic works without it.
- A GitHub token that can only read packages (GitHub → Settings → Developer settings →
  Tokens (classic) → scope `read:packages`), because the app image is private.

## Install

1. Install Docker, and let it start with the machine:

   ```sh
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker "$USER"   # log out and back in afterwards
   sudo systemctl enable docker
   ```

2. Remote access for support, with the clinic owner's agreement (Tailscale, decided
   2026-10-05). Log in with the company Tailscale account:

   ```sh
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up --ssh
   ```

3. Copy the server files from your own machine (over Tailscale, or a USB stick):

   ```sh
   scp -r deploy/appliance <machine>:~/dental
   ```

4. On the server, log in to the image registry and install. Use the version of the
   latest release (a `v0.2.0` tag publishes version `0.2.0`):

   ```sh
   docker login ghcr.io -u reda-jok     # paste the read:packages token
   cd ~/dental
   ./install.sh 192.168.1.10 0.2.0
   ```

   It writes `.env` (the database password and the login secret, readable only by you),
   starts the database, the app and HTTPS, and waits until the app answers.

5. Keep a copy of `~/dental/.env` in the company password manager, under the clinic's
   name.

6. Connect each device (below), then open `https://192.168.1.10/setup` and create the
   clinic and the owner's account.

## Connecting a device

Each device trusts the clinic's own certificate once. Open
`http://192.168.1.10/clinic.crt` (plain `http`) and install it:

- **Android:** the file downloads. Settings → Security → More security settings →
  Encryption & credentials → Install a certificate → **CA certificate** → Install anyway →
  choose `clinic.crt`. (Menus differ by brand: search the settings for "CA certificate".)
- **iPhone / iPad:** open the link in Safari → Allow. Then Settings → General → VPN &
  Device Management → "Clinic server" → Install. Then Settings → General → About →
  Certificate Trust Settings → turn on "Clinic server".
- **Windows:** open the file → Install Certificate → Local Machine → "Place all
  certificates in the following store" → **Trusted Root Certification Authorities**.
  Restart the browser.

Then open `https://192.168.1.10` and add it to the home screen or bookmarks. A warning
page means the certificate isn't trusted yet on that device.

## Before the clinic relies on it (pilot go rules)

- **Offline:** unplug the internet from the router. Log in, book an appointment, chart a
  tooth, take a payment and print the receipt.
- **Printing:** print a real 80 mm receipt with Arabic on the clinic's own printer.
- **Restore:** restore a backup on another machine (`restore.md`).

## Updating

1. Publish the release on your own machine: `git tag v0.2.0 && git push origin v0.2.0`.
   GitHub builds the image (Actions → Release); wait until it's green.
2. After clinic hours, over Tailscale:

   ```sh
   ssh <machine>
   cd ~/dental && ./update.sh 0.2.0
   ```

   It downloads the new version while the clinic keeps working, saves a copy of the
   database in `backups/`, runs the migrations and starts the new app. If anything fails
   it says how to go back.

## Everyday commands (in `~/dental`)

| What | Command |
|---|---|
| Is it up? | `./check.sh` |
| What is running | `docker compose ps` |
| App errors | `docker compose logs --tail 100 app` |
| Restart the app | `docker compose restart app` |
| Version | `grep APP_VERSION .env` |

## Changing the address

Set the new address in `.env` (`CLINIC_HOST=…`), run `docker compose up -d`, then
`./check.sh`. Devices keep trusting the server (the certificate authority stays the
same), but they open the new address.
