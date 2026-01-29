const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { processAudio } = require('./lib/audioProcessor');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);

const inputFile = path.resolve('test_input.wav');

// Generate Test File
console.log('Generating test file...');
ffmpeg()
    .input('sine=frequency=1000:duration=2')
    .inputFormat('lavfi')
    .save(inputFile)
    .on('end', async () => {
        console.log('Test file generated.');
        try {
            console.log('Processing audio...');
            const result = await processAudio(inputFile, 'test_input.wav');
            console.log('Success:', result);

            // Cleanup
            if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
            if (fs.existsSync(result.outputPath)) fs.unlinkSync(result.outputPath);

        } catch (err) {
            console.error('Processing Failed:', err);
            process.exit(1);
        }
    })
    .on('error', (err) => {
        console.error('Generation Failed:', err);
        process.exit(1);
    });
