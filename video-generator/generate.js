#!/usr/bin/env node

/**
 * Vendy-Buildr Video Generator CLI
 * Creates marketing videos using Remotion + ElevenLabs
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.video') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

async function main() {
  console.log('\n🎬 Vendy-Buildr Video Generator\n');

  // Check if API key is configured
  if (!process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY === 'your_api_key_here') {
    console.log('⚠️  ElevenLabs API key not configured!');
    console.log('Please update .env.video with your API key from https://elevenlabs.io\n');

    const proceed = await question('Do you want to continue without voiceover? (y/n): ');
    if (proceed.toLowerCase() !== 'y') {
      console.log('Setup Instructions:');
      console.log('1. Sign up at https://elevenlabs.io');
      console.log('2. Get your API key from the dashboard');
      console.log('3. Add it to .env.video file');
      console.log('4. Run this script again\n');
      rl.close();
      return;
    }
  }

  console.log('Select video type:');
  console.log('1. Tutorial Video (How-to guides)');
  console.log('2. Animated Presentation (Feature showcase)');
  console.log('3. Product Demo (Live demonstration)\n');

  const choice = await question('Enter choice (1-3): ');

  let template;
  switch(choice) {
    case '1':
      template = 'tutorial';
      break;
    case '2':
      template = 'presentation';
      break;
    case '3':
      template = 'demo';
      break;
    default:
      console.log('Invalid choice!');
      rl.close();
      return;
  }

  const title = await question('\nVideo title: ');
  const script = await question('Video script/content: ');

  rl.close();

  console.log('\n🎙️  Generating voiceover...');
  await generateVoiceover(script, template);

  console.log('🎨 Rendering video...');
  await renderVideo(template, { title, script });

  console.log('\n✅ Video generated successfully!');
  console.log(`📁 Output: video-generator/output/${template}-${Date.now()}.mp4\n`);
}

async function generateVoiceover(text, template) {
  // Check if API key exists
  if (!process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY === 'your_api_key_here') {
    console.log('⚠️  Skipping voiceover generation (no API key configured)');
    return null;
  }

  try {
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

    console.log('Calling ElevenLabs API...');

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();

    const outputDir = path.join(__dirname, 'assets', 'audio');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const audioPath = path.join(outputDir, `${template}-${Date.now()}.mp3`);
    fs.writeFileSync(audioPath, Buffer.from(audioBuffer));

    console.log(`✅ Voiceover saved (${(audioBuffer.byteLength / 1024).toFixed(2)} KB)`);
    return audioPath;
  } catch (error) {
    console.error('❌ Error generating voiceover:', error.message);
    return null;
  }
}

async function renderVideo(template, data) {
  // Create output directory
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${template}-${Date.now()}.mp4`);

  return new Promise((resolve, reject) => {
    const remotion = spawn('npx', [
      'remotion',
      'render',
      path.join(__dirname, 'templates', 'index.jsx'),
      template,
      outputPath,
      '--props',
      JSON.stringify(data)
    ]);

    remotion.stdout.on('data', (data) => {
      console.log(data.toString());
    });

    remotion.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    remotion.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`Remotion process exited with code ${code}`));
      }
    });
  });
}

main().catch(console.error);
