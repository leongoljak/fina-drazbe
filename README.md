# FINA Dražbe Plus - Pametni Očevidnik nekretnina

Poboljšana, brza i pregledna verzija službenog portala **FINA Očevidnik nekretnina i pokretnina** (`https://ponip.fina.hr/ocevidnik-web/pocetna`).

---

## 🌟 Ključna poboljšanja u odnosu na FINA-u

1. **⭐ Sustav omiljenih (Favoriti)**
   - Svaki oglas ima ikonu zvjezdice / srca za spremanje jednim klikom.
   - Poseban tab **"⭐ Omiljeno"** na vrhu stranice gdje su svi tvoji spremljeni oglasi na jednom mjestu.
   - Spremanje je automatsko i trajno u tvom pregledniku (ne gubi se gašenjem računala).

2. **🚫 Pametno uklanjanje isteklih dražbi**
   - Za razliku od FINA-e koja prikazuje oglase kojima je rok za jamčevinu odavno prošao, ovdje se prikazuju **isključivo dražbe na koje još uvijek stigneš uplatiti jamčevinu**.
   - Sve dražbe kojima je prošao rok automatski su skrivene.
   - Prikazano je i točno odbrojavanje: npr. *"Hitno: Još 2 dana za jamčevinu"* ili *"Još 35 dana za prijavu"*.

3. **📍 Višestruki odabir županija (Multi-select)**
   - Na FINA-i možeš odabrati samo jednu županiju.
   - Ovdje možeš odabrati **koliko god županija želiš odjednom** (npr. *Grad Zagreb*, *Zagrebačka* i *Istarska*).
   - Dostupni su i brzi gumbi regija (*Zagreb i okolica*, *Jadran / More*, *Slavonija*).

4. **🏡 Filtriranje po vrsti nekretnine i pretraga**
   - Brzi odabir: Stanovi, Kuće, Zemljišta, Poslovni prostori, Garaže.
   - Pretraga u stvarnom vremenu po gradu, adresi, broju spisa ili sudu.
   - Sortiranje po najhitnijem roku jamčevine ili po cijeni.

5. **🔍 Puni detalji i lokacija**
   - Klikom na karticu otvara se prozor sa svim detaljima, opisom iz sudskog spisa, katastarskim podacima i točnim koordinatama.
   - Izravne poveznice na originalni FINA oglas i sudska pismena.

6. **🔄 Ažurni podaci**
   - Gumb **"Osvježi podatke"** omogućuje da u nekoliko sekundi povučeš sve najnovije objavljene dražbe izravno s FINA poslužitelja.

---

## 🚀 Kako pokrenuti aplikaciju

### Najjednostavniji način:
Otvori Terminal i upiši:
```bash
/Users/monika/.gemini/antigravity/scratch/fina-drazbe/start.sh
```
Skripta će automatski pokrenuti poslužitelj i otvoriti stranicu u tvom web pregledniku na adresi:
👉 **`http://localhost:3000`**

### Ručno pokretanje:
```bash
cd /Users/monika/.gemini/antigravity/scratch/fina-drazbe
ruby server.rb
```
I u preglednik upiši `http://localhost:3000`.
