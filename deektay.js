export class Deektay {
    constructor(source, type='guess', lang='en', element='body') {
	this.lang = Deektay.trans[lang];
	if (!this.lang)
	    throw new Error('Unknown language ' + lang);
	
	this.source = source;
	
	this.type = type == 'guess'
	    ? (source.endsWith('.json')
	       ? 'json'
	       : source.endsWith('.txt') || source.endsWith('.text')
	       ? 'txt'
	       : new Error('Cannot guess the file type of ' + source))
	    : type == 'txt' || type == 'json'
	    ? type
	    : new Error('unknown type ' + type);
	if (this.type instanceof Error)
	    throw this.type;

	this.root = document.querySelector(element);
	if (!this.root)
	    throw new Error('Cannot find element ' + element);
	
	this.current = 0;
    }
    
    start() {
	return fetch(this.source)
	    .then(s => this.type == 'txt'
		  ? s.text().then(d => this.parse_text(d))
		  : s.json())
	    .then(d => this.clips = d)
	    .then(() => this.activate());
    }
    
    parse_text(text) {
	let data = [];
	text.split('\n')
	    .forEach((line) => {
		let s = line.split(/:\s+/);
		if (s.length > 1 && s[0]) {
		    data.push({
			media: s[0],
			sentence: s.slice(1).join(': '),
		    });
		} else {
		    console.warn('Discarded line:', line);
		}
	    });
	return data;
    }

    activate() {
	let css = document.createElement('style');
	css.innerText = Deektay.stylesheet;
	document.head.append(css);
	
	this.root.innerHTML = Deektay.main;
	this.sentences = this.root.querySelector('#sentences');
	this.check = this.root.querySelector('#check');
	this.check.innerText = this.lang.check;
	this.skip = this.root.querySelector('#skip');
	this.skip.innerText = this.lang.skip;
	this.score = this.root.querySelector('#score');
	this.controls = this.root.querySelector('#controls');

	this.check.addEventListener('click', () => {
	    let sntc = document.querySelector('.sentence.active');
	    let answ = sntc.querySelector('.answer');
	    let corr = this.check_answer(answ.innerText, answ.dataset.hint);
	    let hint = sntc.querySelector('.hint');
	    hint.innerHTML = corr.hint;
	    hint.classList.add(corr.right ? 'right' : 'wrong');
	    
	    this.render_next();
	});
	this.skip.addEventListener('click', () => {
	    this.render_next();
	});
	this.sentences.addEventListener('keyup', (e) => {
	    console.log(e, e.target.parentNode);
	    if (e.target.classList.contains('answer')
		&& e.target.parentNode.classList.contains('active')) {
		this.check.disabled = e.target.innerText === '';
	    }
	});

	this.render_next();
    }
    
    render_next() {
	let act = document.querySelector('.sentence.active');
	act && act.classList.remove('active');
	
	if (this.current < this.clips.length) {
	    let next = this.clips[this.current];
	    this.current++;
	    
	    this.sentences.innerHTML += Deektay.sentence;
	    let sntc = this.sentences.lastChild;
	    let audio = sntc.querySelector('audio');
	    audio.src = next.media;
	    let answer = sntc.querySelector('.answer');
	    answer.dataset.hint = next.sentence;
	    let play = sntc.querySelector('.play');
	    play.addEventListener('click', () => {
		audio.play();
		answer.focus();
	    });
	    play.dispatchEvent(new Event('click'));
	} else {
	    this.controls.classList.add('done');
	    for (let c of this.clips)
		this.score.innerHTML += '<p>' + c.sentence + '</p>';
	}
    }

    check_answer(answer, hint) {
	return {
	    right: answer == hint,
	    hint: hint,
	};
    }

    tokenize(sentence, lower=false) {
	let seps = /\s+|([.,;:!?"'\-\(\)\[\]¿¡–—―«»<>‘’…]+)/g;
	let tokens = [];
	let ind = 0;
	let match;
	while ((match = seps.exec(sentence)) !== null) {
	    if (match.index > ind) {
		let tok = this.normalize(sentence.substring(ind, match.index), lower);
		tokens.push({
		    token: tok,
		    index: ind,
		    length: tok.length,
		});
	    }
	    if (match[1]) {
		tokens.push({
		    token: this.normalize(match[1]),
		    index: match.index,
		    length: match[1].length,
		})
	    }
	    ind = match.index + match[0].length;
	}
	return tokens;
    }

    normalize(token, lower=false) {
	if (lower)
	    token = token.toLowerCase();
	switch (token) {
	case '<<': case '«': case '>>': case '»': case '”': case '“':
	    token = '"';
	    break;
	case "‘": case "’": case "'": case "'":
	    token = "'";
	    break;
	case '–': case '—': case '―':
	    token = '-';
	    break
	case '…':
	    token = '...';
	    break;
	}
	return token;
    }
}

Deektay.main = `<div id="sentences"></div>
<div id="score"></div>
<div id="controls">
  <button id="check" disabled="true"></button>
  <button id="skip"></button>
</div>`;

Deektay.sentence = `<div class="sentence active">
  <button class="play">&gt;</button>
  <audio style="display:none"></audio>
  <p class="hint"></p>
  <p class="answer" contentEditable="true"></p>
</div>`;

Deektay.stylesheet = `
#controls.done { display: none; }
.sentence { pointer-events: none; }
.sentence.active { pointer-events: auto; }
.answer { height: 1em; }
.right { color: green; }
.wrong { color: red; }
`;

Deektay.trans = {
    'en': {
	'skip': 'skip',
	'check': 'check',
	'error': 'error',
	'errors': 'errors',
	'noerr': 'no errors',
    },
    'fr': {
	'skip': 'passer',
	'check': 'controler',
	'error': 'erreur',
	'errors': 'erreurs',
	'noerr': "pas d'erreurs",
    },
    'it': {
	'skip': 'passa',
	'check': 'controlla',
	'error': 'errore',
	'errors': 'errori',
	'noerr': 'nessun errore',
    }
};
