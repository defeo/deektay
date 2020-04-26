# Deektay

A dictation app.

## Dictation

Dictation is a popular exercise in primary and middle schools in many
countries, especially as France.

Deektay is a single-page static web app for self-assessed dictation
exercices.  Just drop a bunch of audio files in a folder, a `.txt`
file, and an `index.html`, and Deektay generates the user interface.

See <https://defeo.lu/deektay> for a demo.

## Who needs Deektay?

Deektay is primarily meant for teachers.  However, using it requires
some advanced skills such as:

- Recording and converting audio files,
- Editing a plain text file,
- Hosting static web pages.

It will thus only be useful to a rare breed of teachers:

```
┌────────────────────┐
│     Language       │
│     Teachers       │
│        ┌───────────┤─────┐
│        │  Deektay  │     │
└────────┼───────────┘     │
	 │      Computer   │
	 │       Geeks     │
         └─────────────────┘
```


## Usage

1. Chose a text for dictation.

2. Record it, one sentence per file. We recommend using
   [Audacity](https://www.audacityteam.org/), but you may also find
   [Castaphone](https://defeo.lu/castaphone) useful.
   
3. Optionally convert the files to several audio formats (see
   [compatibility](#Compatibility) below).
   
4. Put all audio files in a folder, together with a `data.txt` file 
   formatted like:
   
   ```
   file1.ogg,file1.mp3,file1.aac: The sky above the port was the color of television,
                                : The sky above the port was the colour of television,
   file2.ogg,file2.mp3,file2.aac: tuned to a dead channel.
   ```
   
   Each line being of the form
   
   ```
   [list of files]: <sentence>
   ```
   
   where `[list of files]` is an optional, comma separated, list of
   audio files, all meant to be an audio recording of the same
   sentence; and `<sentence>` is the corresponding text. If the list
   of files is missing, `<sentence>` is understood as an alternate
   spelling for the sentence on the previous line.
   
   See also [docs/data.txt](docs/data.txt).
   
5. Also put an `index.html` file in the same folder. See
   [docs/index.html](docs/index.html) for an example.
   
6. Upload the folder to a web server.

7. Send the link to your students.


## Compatibility
 
Deektay was developed with high compatibility in mind. As far as we
know, it is compatible with desktop and mobile browsers released as
far back as 2013, such as Internet Explorer 10, Firefox 20, etc.

However, while Deektay itself is compatible with most browsers, the
audio files themselves may have troubles loading. At the time of
writing, the most widely supported audio format is `.aac` (or `.mp4`,
it's the same), followed closely by `.mp3` and `.ogg`.  We recommend
converting your audio files to each of these formats, and using the
comma separated syntax shown above to provide alternative recordings
for the same sentence.

Here's a quick table of format support:

| | Chrome | Firefox | IE | Edge | Safari|
|-|--------|---------|----|------|-------|
| aac | Yes | (Yes) | Yes | Yes | Yes|
| wav | Yes | Yes | No  | Yes | Yes|
| mp3 | Yes | >71 | Yes | Yes | Yes|
| ogg | Yes | Yes | No  | (No)| No|

For more information, see [this Wikipedia
page](https://en.wikipedia.org/wiki/HTML5_audio#Supported_audio_coding_formats).


## Configuring, language

The standard way to load Deektay is:

```js
var deektay = new Deektay('data.txt', { 
    lang: 'fr',
    element: '#deektay',
    type: 'guess',
	check_caps: false,
});
deektay.start()
```

See for example, [docs/index.html](docs/index.html).

A few options can be configured:

- The data file can be named aything you want. Just change
  `'data.txt'` to the correct file name.

- `lang` indicates the language of the user interface. Current choices
  are `'en'`, `'fr'`, and `'it'`. Default is `fr`.
  
  If you would like to see another language supported, please open an
  issue.
  
- `element` indicates the tag where Deektay should insert
  itself. Default is `'#deektay'`.

- `type` is the type of `data.txt`. Choices are: `text` for text file,
  `json` for Json files, and `guess` (default) which guesses based on
  the file extension.
  
  The text format is documented above. The json format is
  
  ```js
  [
    {
      media: ['file1.ogg', 'file1.mp3', 'file1.aac'],
      sentence: [
        'The sky above the port was the color of television',
        'The sky above the port was the colour of television',
      ],
    },
  ]
  ```
  
  If you don't understand what this means, you probably want to use
  the text format.

- `check_case` indicates whether Deektay matching should be
  case-sensitive or not. Default is not.


## Developers

To generate the polyfilled minified file, first install Babel with

```
npm install
```

Then

```
npm run minify
```
