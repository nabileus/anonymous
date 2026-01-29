const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

async function processAudio(inputPath, originalName) {
    const outputName = `${path.parse(originalName).name}_filtered.wav`;
    const outputPath = path.join(os.tmpdir(), outputName);

    // Python logic:
    // mixed += librosa.effects.pitch_shift(y, sr=sr, n_steps=steps) for steps in [4, -3]
    // This creates TWO pitch shifted versions and adds them to the original?
    // Wait, `mixed = y.copy()` then `mixed += ...`. 
    // Original code:
    // mixed = y.copy()
    // for steps in [4, -3]:
    //    mixed += librosa.effects.pitch_shift(...)
    // So it is: Original + Shift(+4) + Shift(-3). (If `mixed` accumulates).
    // Let's verify standard addition. Yes, it's superposition.

    // In ffmpeg, we can use complex filters to create streams and mix them.
    // Inputs: [0:a] (Original)
    // Filter 1: [0:a] asetrate=... [v1] (Shift +4)
    // Filter 2: [0:a] asetrate=... [v2] (Shift -3)
    // Mix: [0:a][v1][v2] amix=inputs=3 [out]

    // Pitch shifting with `asetrate` changes tempo (chipmunk effect). 
    // `librosa.effects.pitch_shift` preserves duration. 
    // To preserve duration in ffmpeg we usually use `rubberband` (needs ext library) or `atempo` filter.
    // `atempo` is built-in. 
    // Steps to ratio: 2^(steps/12). 
    // +4 steps: 2^(4/12) ≈ 1.2599
    // -3 steps: 2^(-3/12) ≈ 0.8409

    // Filter chain for +4: `asetrate=44100*1.2599,atempo=1/1.2599`
    // Wait, simpler generic pitch filter is asking for trouble with artifacts.
    // Let's try to map roughly. The user wants that specific effect.
    // If we use `asetrate`, it changes speed. If the Python code used `pitch_shift`, it preserves speed.
    // So we need to correct speed with `atempo`.

    // Note: librosa pitch_shift is high quality. ffmpeg 'atempo' allows tempo change, 'asetrate' changes pitch+speed.

    return new Promise((resolve, reject) => {
        const command = ffmpeg(inputPath);

        // We need 3 copies of the stream?
        // fluent-ffmpeg complex filters syntax can be verbose.

        // Ratio calculations
        const r1 = Math.pow(2, 4.0 / 12.0); // ~1.2599
        const r2 = Math.pow(2, -3.0 / 12.0); // ~0.8409

        // Note: sample rate is assumed to be detected by ffmpeg, but asetrate needs a value.
        // We'll multiply the input sample rate. 
        // Usually we can imply 44100 or 48000, but better to be safe.
        // Let's use `rubberband` if available? No, ffmpeg-static usually doesn't include it.
        // We'll stick to asetrate+atempo but we need to know the sample rate.
        // simpler approach: use `rubberband` filter if possible, but safer to use `asetrate` assuming standard SR or probing first.

        // Let's probe first to get sample rate seems safer, but let's try a filter that works relatively?
        // `rubberband` filter is the best for pitch shifting without duration change, but might not be in the build.
        // Alternative: just use `asetrate` and don't correct tempo? No, `pitch_shift` implies duration preservation.

        // Let's try just mixing them. 
        // If we can't do perfect pitch shift efficiently, maybe just one layer? 
        // But the user wants "convert this". I should try to be close.

        // Complex filter string approximation:
        // [0:a]asplit=3[base][p1][p2];
        // [p1]asetrate=44100*1.26,atempo=1/1.26[shift1];
        // [p2]asetrate=44100*0.84,atempo=1/0.84[shift2];
        // [base][shift1][shift2]amix=inputs=3:duration=first[out]

        // We assume 44100 for `asetrate` base if we don't know it. 
        // This might cause speed change if source is 48k.
        // Let's just use `rubberband` if I can? Probably not.

        // Actually, Python `librosa.load(..., sr=None)` keeps original SR.

        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) return reject(err);

            const sr = metadata.streams.find(s => s.codec_type === 'audio')?.sample_rate || 44100;
            const r1_rate = Math.round(sr * r1);
            const r2_rate = Math.round(sr * r2);
            const tempo1 = (1 / r1).toFixed(4);
            const tempo2 = (1 / r2).toFixed(4);

            command
                .complexFilter([
                    '[0:a]asplit=3[base][p1][p2]',
                    `[p1]asetrate=${r1_rate},atempo=${tempo1}[shift1]`,
                    `[p2]asetrate=${r2_rate},atempo=${tempo2}[shift2]`,
                    '[base][shift1][shift2]amix=inputs=3:duration=first[out]'
                ])
                .outputOptions(['-map [out]'])
                .save(outputPath)
                .on('end', () => resolve({ outputPath, outputName }))
                .on('error', (err) => reject(err));
        });
    });
}

module.exports = { processAudio };
