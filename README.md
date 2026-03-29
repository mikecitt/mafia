# Mafija Helper

Web aplikacija za vodjenje partije Mafije / Werewolf bez moderatora tokom pocetnih krugova.

## Sta v1 pokriva

- host kreira partiju i ujedno je igrac
- host tek u lobby-ju podesava uloge
- igraci ulaze preko koda i nadimka
- reconnect radi preko istog nadimka
- broj igraca se uzima iz broja trenutno povezanih ljudi
- host bira broj mafijasa i da li postoje lekar, policajac i dama
- nakon starta postoji poseban korak gde svaki igrac drzanjem klika otkriva svoju ulogu
- host nakon toga rucno pokrece prvu noc
- noc ide po redu: dama, mafija, lekar, policajac
- svi telefoni dobijaju isti prompt i browser TTS komandu
- samo odgovarajuca uloga moze da napravi potez
- prvi mafijas koji klikne bira metu mafije
- lekar moze da leci sebe i istu osobu vise puta
- po svitanju se prikazuju ubijeni i ucutkani igrac
- host oznacava da li je neko izglasan ili se ide u novi krug
- kada prvi igrac bude izglasan, njemu se otkljucava moderatorski prikaz sa svim ulogama i istorijom noci
- host moze u svakom trenutku da zaustavi partiju i vrati sve u lobby

## Ogranicenja v1

- nema baze; stanje zivi samo dok je Next.js proces aktivan
- restart containera ili procesa gasi sve aktivne partije
- za produkciju koristi jednu instancu aplikacije; nema deljenog state-a izmedju vise replika
- nema naloga ni autentikacije; reconnect je iskljucivo po nadimku
- nema automatske provere pobede
- dama nema kasniju transformaciju u mafiju, jer aplikacija prestaje da vodi partiju cim se pojavi prvi moderator

## Pokretanje

```bash
npm install
npm run dev
```

Otvori `http://localhost:3000`.

## Provera

```bash
npm run lint
npm run build
```

## Docker

Image je pripremljen za standardni Node runtime i koristi Next.js `standalone` output.

### Build i run

```bash
docker build -t mafia-helper .
docker run -d \
  --name mafia-helper \
  --restart unless-stopped \
  -p 3000:3000 \
  mafia-helper
```

### Docker Compose

```bash
docker compose up -d --build
```

Koristi prilozeni [compose.yaml](./compose.yaml).

## TrueNAS SCALE

Najvaznije stvari za TrueNAS:

- pokreci samo jednu instancu containera
- izlozi TCP port `3000`
- ako container restartuje, aktivne partije se gube
- za lokalnu mrezu otvaraj aplikaciju na `http://<ip-od-truenas-servera>:3000`

Ako koristis Custom App / YAML pristup, mozes krenuti od `compose.yaml`. Ako tvoj setup trazi image umesto lokalnog build konteksta, prvo uradi `docker build`, pushuj image na registry koji koristis, pa u YAML-u zameni `build:` sa `image:`.
