class Deektay {
    constructor(source, { type='guess', lang='fr', element='body' }) {
	this.lang = Deektay.trans[lang];
	if (!this.lang)
	    throw new Error('Unknown language ' + lang);
	
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
	
	this.clips = null;
	this.current = 0;
    
	this.xhr = new XMLHttpRequest();
	this.xhr.open('get', source);
	this.xhr.responseType = this.type == 'txt' ? 'text': 'json';
	this.xhr.onload = (e) => {
 	    this.clips = this.type == 'txt'
		? this.parse_text(this.xhr.response)
		: this.xhr.response;
	    this.activate();
	}
    }

    start() {
	this.xhr.send();
    }
    
    parse_text(text) {
	let data = [];
	text.split('\n')
	    .forEach((line) => {
		let s = line.split(/:\s+/);
		if (s.length > 1 && s[0]) {
		    let sent = s.slice(1).join(': ');
		    if (!s[0].trim()) {
			data[data.length-1].sentence.push(sent);
		    } else {
			data.push({
			    media: s[0].split(','),
			    sentence: [sent],
			});
		    }
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
	    let hint = sntc.querySelector('.hint');

	    let answ_t = answ.innerText;
	    
	    let corr = JSON.parse(answ.dataset.hints).map(h => ({
		hint: h,
		corr: this.check_answer(answ_t, h),
	    })).reduce((a, b) => a.errors < b.errors ? a : b);
	    console.log(corr);
	    
	    let gen_diff = (tokens, orig) => {
		let cur = 0;
		let str = "";
		for (let t of tokens) {
		    if (t.index > cur)
			str += orig.substring(cur, t.index);
		    cur = t.index + t.length;
		    str += `<span class="${t.good?'right':'wrong'}">${orig.substring(t.index,cur)}</span>`;
		}
		return str;
	    }
	    let answ_str = gen_diff(corr.corr.a_tokens, answ_t);
	    let hint_str = gen_diff(corr.corr.h_tokens, corr.hint);

	    console.log(answ_str, hint_str);
	    
	    answ.innerHTML = answ_str;
	    hint.innerHTML = hint_str;
	    hint.classList.add(corr.corr.errors == 0 ? 'right' : 'wrong');
	    
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
	    for (let m of next.media) {
		audio.innerHTML += `<source src="${m}">`
	    }
	    let answer = sntc.querySelector('.answer');
	    answer.dataset.hints = JSON.stringify(next.sentence);
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
	let atok = this.tokenize(answer),
	    htok = this.tokenize(hint);
	let diff = this.diff(atok.map(x => x.token),
			     htok.map(x => x.token));

	for (let [ai, hi] of diff) {
	    atok[ai].good = htok[ai].good = true;
	}
	
	return {
	    errors: htok.length - diff.length,
	    a_tokens: atok,
	    h_tokens: htok,
	};
    }

    diff(A, B) {
	let n = A.length+1, m = B.length+1;
	let tab = new Uint32Array(n * m);
	for (let i = 1; i < n; i++) {
	    for (let j = 1; j < m; j++) {
		let tl = tab[i-1 + n*(j-1)] & ~3,
		    l  = tab[i   + n*(j-1)] & ~3,
		    t  = tab[i-1 + n*j    ] & ~3;
		if (A[i-1] == B[j-1]) {
		    tab[i + n*j] = tl + 4 | 0;
		} else {
		    if (t > l) 
			tab[i + n*j] = t | 1;
		    else if (t == l)
			tab[i + n*j] = t | 3;
		    else
			tab[i + n*j] = l | 2;
		}
	    }
	}

	let seq = [];
	for (let i = n-1, j = m-1; i > 0 && j > 0; ) {
	    if (tab[i + n*j] & 1) {
		i--;
	    } else if (tab[i + n*j] & 2) {
		j--;
	    } else {
		seq.push([i-1, j-1]);
		i--; j--;
	    }
	}
	return seq;
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

	if (ind < sentence.length) {
	    let tok = this.normalize(sentence.substring(ind, sentence.length), lower);
	    tokens.push({
		token: tok,
		index: ind,
		length: tok.length,
	    });
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
.hint.right { outline: solid thin green; }
.hint.wrong { outline: solid thin red; }
span.wrong { background-color: red; color: white; }
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
	'check': 'contrôler',
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
