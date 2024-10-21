# scribe_cast
Document-to-Dialogue Translator

## Prerequisites
[Piper](https://github.com/rhasspy/piper), a fast local neural text to speech system. You can download the executable corresponding to your operating system and CPU architecture from [Releases](https://github.com/rhasspy/piper/releases). For example:  
```console
$ curl -L -O https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz
$ tar xvzf piper_linux_x86_64.tar.gz # Extract file 
$ cd piper/ # Navigate to extracted file 
$ chmod u+x piper # Set piper mode to executable
$ mkdir models/ # Create a models directory to save voice models and configurations
```
[Piper voices](https://github.com/rhasspy/piper/blob/master/VOICES.md). For example:  
```console
$ cd models/
$ curl -L -O https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alba/medium/en_GB-alba-medium.onnx # Download voice model 
$ curl -L -O https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alba/medium/en_GB-alba-medium.onnx.json # Download model config 
```

### Usage from CLI
`piper` can be run for Text-To-Speech (TTS) as follows:  
```console
# Save speech to file
$ cat my_file.md | ./piper --model en_GB-alba-medium.onnx --output_file my_file.wav 
$ # Optionally, convert to .mp3 with ffmpeg
$ ffmpeg -i my_file.wav -vn -ar 44100 -ac 2 -b:a 192k my_file.mp3
```

or  

```console
# Stream to stdout
$ cat my_file.md | ./piper --model en_GB-alba-medium..onnx --output-raw | \
  aplay -r 22050 -f S16_LE -t raw - 
```

