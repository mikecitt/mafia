# Mafija Helper

Web aplikacija za vodjenje partije Mafije / Werewolf bez moderatora tokom pocetnih krugova.

## Sta v1 pokriva

- host kreira partiju i ujedno je igrac
- host tek u lobby-ju podesava broj igraca i uloge
- igraci ulaze preko koda i nadimka
- reconnect radi preko istog nadimka
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
