# Restoring the database

## From a copy saved by an update

`update.sh` saves the database to `~/dental/backups/before-<version>-<date>.dump` before
it changes anything. Restoring one replaces the whole database with that moment's:
**everything entered after it is lost**, so first tell the clinic, and note what was done
since (payments, appointments) to enter again.

```sh
cd ~/dental
docker compose stop app
docker compose exec -T db dropdb -U dental --force dental
docker compose exec -T db createdb -U dental dental
docker compose exec -T db pg_restore -U dental -d dental --no-owner < backups/<file>.dump
docker compose up -d     # applies any migrations newer than the copy
./check.sh
```

To go back to the version that made the copy, set `APP_VERSION` in `.env` to it before
`docker compose up -d`.

X-rays and documents (the `uploads` volume) and the clinic certificate (the `caddy`
volume) are not in these copies. An update never changes them.
