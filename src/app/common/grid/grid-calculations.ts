export const Grid = {
    nextIndex(currentIndex: number, direction: 'l' | 'r' | 'u' | 'd', gridWidth: number, length: number): number {
    // 1. Berechne aktuelle 2D-Koordinaten
    // x = Spalte, y = Zeile
    let x = currentIndex % gridWidth;
    let y = Math.floor(currentIndex / gridWidth);

    // Bestimme die Anzahl der (potenziellen) Zeilen
    const gridHeight = Math.ceil(length / gridWidth);

    // 2. Navigation mit Wrap-Around Logik
    switch (direction) {
        case 'l': // Links
            x = (x - 1 + gridWidth) % gridWidth;
            break;
        case 'r': // Rechts
            x = (x + 1) % gridWidth;
            break;
        case 'u': // Oben
            y = (y - 1 + gridHeight) % gridHeight;
            break;
        case 'd': // Unten
            y = (y + 1) % gridHeight;
            break;
    }

    // 3. Zurückrechnen in 1D-Index
    let newIndex = y * gridWidth + x;

    // 4. Sonderfall-Behandlung:
    // Falls das Grid nicht perfekt gefüllt ist (letzte Zeile ist kürzer),
    // und wir auf einem leeren Feld landen würden:
    if (newIndex >= length) {
        if (direction === 'd') {
            // Wenn wir nach unten auf ein leeres Feld springen, nehmen wir das erste Element der Spalte (Oben)
            newIndex = x;
        } else if (direction === 'u') {
            // Wenn wir nach oben springen und dort leer wäre (theoretisch nur bei sehr unebenen Grids),
            // nehmen wir das letzte verfügbare Element der Spalte
            newIndex = (y - 1) * gridWidth + x;
        } else {
            // Bei Seitwärtsbewegungen einfach das letzte Element des Arrays
            newIndex = length - 1;
        }
    }

    return newIndex;
}
}
