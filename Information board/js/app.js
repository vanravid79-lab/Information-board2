const dotsPerGrid = 25;
const gridsPerSide = 6;

function generateDotGrid() {
    const container = document.createElement('section');
    container.className = 'boxContainer';

    for (let j = 0; j < dotsPerGrid; j++) {
        const box = document.createElement('div');
        box.className = 'box';
        container.appendChild(box);
    }
    return container;
}

const leftSide = document.getElementById('left-side');
const rightSide = document.getElementById('right-side');

for (let i = 0; i < gridsPerSide; i++) {
    leftSide.appendChild(generateDotGrid());
    rightSide.appendChild(generateDotGrid());
}

