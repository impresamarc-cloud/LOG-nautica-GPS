# Log Nautico GPS - Progetto Android Nativo (Kotlin + Jetpack Compose)

Questa applicazione è un **progetto nativo Android** per smartphone Samsung Galaxy S24+ (e tutti i dispositivi Android con Android 8.0+ / API 26-35).

---

## ⚠️ NOTA IMPORTANTE PER ANDROID STUDIO
Se vedi questa schermata all'apertura in Android Studio, **NON è un errore**! È il file di benvenuto del progetto.

Il progetto Android nativo si trova all'interno della cartella `app/` ed è configurato con Gradle.

---

## 🚀 Come Aprire e Compilare in Android Studio

1. **Apri Android Studio**:
   - Vai su **File > Open...** (oppure nella schermata iniziale di Android Studio clicca su **Open**).
   - Seleziona la cartella principale del progetto: `Log Nautico gps`.

2. **Avvia il Gradle Sync**:
   - In alto a destra clicca sull'icona dell'elefante blu: **Sync Project with Gradle Files** (oppure dal menu: **File > Sync Project with Gradle Files**).
   - Nel pannello di sinistra, passa alla vista **Android** per visualizzare:
     - `app`
       - `manifests` (`AndroidManifest.xml`)
       - `java` (`com.nautica.gps`)
         - `MainActivity.kt`
         - `service/MarineGpsService.kt`
         - `ui/MarineMainScreen.kt`
         - `ui/components/...`
       - `res` (layout, stringhe, temi)
     - `Gradle Scripts` (`build.gradle.kts`, `settings.gradle.kts`)

3. **Compilazione ed Esecuzione su Samsung Galaxy S24+**:
   - Collega il tuo smartphone Samsung Galaxy S24+ via cavo USB.
   - Sul telefono assicurati di aver attivato le **Opzioni Sviluppatore** e il **Debug USB** (*Impostazioni > Informazioni sul telefono > Informazioni software > tocca 7 volte 'Versione build', poi Impostazioni > Opzioni sviluppatore > Debug USB attivo*).
   - Nel selettore dei dispositivi in alto nella barra degli strumenti di Android Studio, seleziona il tuo **Samsung Galaxy S24+** (oppure un emulatore Android).
   - Clicca sul tasto verde **Run** (icona ▶ *Play*) oppure premi `Shift + F10`.
   - Android Studio compilerà l'app in formato `.apk` e la installerà automaticamente sul tuo telefono!

4. **Creare l'APK da installare manualmente**:
   - Se vuoi generare il file APK da inviare o copiare sul telefono, dal menu in alto clicca:
     **Build > Build Bundle(s) / APK(s) > Build APK(s)**
   - Al termine della compilazione, comparirà in basso a destra la notifica **locate**: cliccandoci troverai il file `app-debug.apk` pronto per essere installato su qualsiasi telefono Android.

---

## ⚓ Caratteristiche Native Implementate

- **Tachimetro Raymarine i50**: Display OLED nero puro a 3 cifre giganti in nodi (kts) e km/h con telemetria trip (max, media, distanza NM, tempo).
- **Bussola Curva a 60°**: Disegnata con accelerazione hardware a 120Hz via Compose Canvas, con tacche graduate 1°/5°/10°, rombo mobile del waypoint attivo e frecce animate di correzione timone.
- **Carta Nautica & Waypoints**: Mappa con tile OpenSeaMap (boe, mede, fari, isobate), tracciamento scia GPS, linea di prua infinita, waypoints trascinabili e **cancellazione con sola "X"**.
- **Foreground Service GPS**: Tracciamento continuo a 1 Hz in background che non si ferma mai, nemmeno a schermo spento su Samsung One UI.
- **Allarmi Sonori & Haptic**: Allarme acustico e vibrazione all'ingresso nel cerchio di arrivo (35 metri dal waypoint).
