const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

// Register Font
// In Vercel serverless, process.cwd() is the root.
const fontPath = path.join(process.cwd(), 'public', 'assfont.ttf');
const templatePath = path.join(process.cwd(), 'public', 'template.jpg');

// Ensure font is registered. 
// Note: We might need to handle the font family name carefully.
if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, 'AssFont');
} else {
    console.warn('Font file not found at:', fontPath);
}

async function generatePages(text) {
    // Load Template
    const template = await loadImage(templatePath);
    const width = template.width;
    const height = template.height;

    // Font Config
    const fontSize = 30;
    const fontFamily = 'AssFont';

    // We need a dummy context to measure text
    const dummyCanvas = createCanvas(1, 1);
    const dummyCtx = dummyCanvas.getContext('2d');
    dummyCtx.font = `${fontSize}px ${fontFamily}`;

    // Calculate dimensions
    // Python: bbox = font.getbbox("hg") -> (left, top, right, bottom)
    // Canvas: measureText doesn't give precise bbox line height the same way, 
    // but we can approximate or use actual measurements.
    // Python code: line_height = (bbox[3] - bbox[1]) + 3
    // Standard approximation: fontSize * 1.2 or similar. 
    // Let's rely on measureText for width, and a fixed line height for now to match visual.
    // "hg" in size 30 usually gives around 30-35px height.
    const metrics = dummyCtx.measureText('hg');
    const lineHeight = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) + 5;
    // Adjust +5 to match the +3 from Python's tight bbox

    const startX = 150;
    const startY = 140;
    const maxWidth = width - startX - 10;
    const maxY = height - (3 * lineHeight); // Approx matching Python: height - (3 * line_height)

    const lines = [];
    const spaceWidth = dummyCtx.measureText(' ').width;

    // Text Wrapping Logic
    const paragraphs = text.split('\n');
    for (const paragraph of paragraphs) {
        if (dummyCtx.measureText(paragraph).width <= maxWidth) {
            lines.push(paragraph);
        } else {
            const words = paragraph.split(' ');
            let currLine = words[0];
            let currW = dummyCtx.measureText(words[0]).width;

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const wordW = dummyCtx.measureText(word).width;
                if (currW + spaceWidth + wordW <= maxWidth) {
                    currLine += ' ' + word;
                    currW += spaceWidth + wordW;
                } else {
                    lines.push(currLine);
                    currLine = word;
                    currW = wordW;
                }
            }
            lines.push(currLine);
        }
    }

    // Drawing Logic
    const buffers = [];
    let currY = startY;
    let canvas = createCanvas(width, height);
    let ctx = canvas.getContext('2d');

    // Draw initial background
    ctx.drawImage(template, 0, 0);
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = 'rgb(1, 22, 55)'; // fill=(1, 22, 55)

    for (const line of lines) {
        if (currY + lineHeight > maxY) {
            // Save Page
            buffers.push(canvas.toBuffer('image/jpeg'));

            // New Page
            canvas = createCanvas(width, height);
            ctx = canvas.getContext('2d');
            ctx.drawImage(template, 0, 0);
            ctx.font = `${fontSize}px ${fontFamily}`;
            ctx.fillStyle = 'rgb(1, 22, 55)';
            currY = startY;
        }

        ctx.fillText(line, startX, currY); // Canvas fillText x,y is usually baseline. 
        // Python draw.text((x,y)) is top-left.
        // We might need to adjust Y by ascent.
        // Let's check textBaseline. default is 'alphabetic'. 
        // We probably want 'top' to match `draw.text` coords more easily.
        // Or adjust `currY` by `metrics.actualBoundingBoxAscent` or similar.
        // Setting textBaseline = 'top' is easiest to match Python's default behavior.

        ctx.textBaseline = 'top';
        // Re-draw text with logic
        ctx.fillText(line, startX, currY);

        currY += lineHeight;
    }

    buffers.push(canvas.toBuffer('image/jpeg'));
    return buffers;
}

module.exports = { generatePages };
