export const Grid = {
    nextIndex(currentIndex: number, direction: 'l' | 'r' | 'u' | 'd', gridWidth: number, length: number): number {
    // 1. Calculate current 2D coordinates
    // x = column, y = row
    let x = currentIndex % gridWidth;
    let y = Math.floor(currentIndex / gridWidth);

    // Determine the number of (potential) rows
    const gridHeight = Math.ceil(length / gridWidth);

    // 2. Navigation with wrap-around logic
    switch (direction) {
        case 'l': // Left
            x = (x - 1 + gridWidth) % gridWidth;
            break;
        case 'r': // Right
            x = (x + 1) % gridWidth;
            break;
        case 'u': // Up
            y = (y - 1 + gridHeight) % gridHeight;
            break;
        case 'd': // Down
            y = (y + 1) % gridHeight;
            break;
    }

    // 3. Convert back to 1D index
    let newIndex = y * gridWidth + x;

    // 4. Edge case handling:
    // If the grid is not perfectly filled (last row is shorter),
    // and we would land on an empty cell:
    if (newIndex >= length) {
        if (direction === 'd') {
            // If we jump down to an empty cell, we take the first element of the column (top)
            newIndex = x;
        } else if (direction === 'u') {
            // If we jump up and it would be empty (theoretically only with very uneven grids),
            // we take the last available element of the column
            newIndex = (y - 1) * gridWidth + x;
        } else {
            // For lateral movements, just take the last element of the array
            newIndex = length - 1;
        }
    }

    return newIndex;
}
}


