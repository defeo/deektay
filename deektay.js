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
	this.errors = { words: 0, sentences: 0 };
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
		if (s.length > 1) {
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
	this.root.innerHTML = Deektay.main;
	this.sentences = this.root.querySelector('#sentences');
	this.check = this.root.querySelector('#check');
	this.check.innerText = this.capitalize(this.lang.check);
	this.skip = this.root.querySelector('#skip');
	this.skip.innerText = this.capitalize(this.lang.skip);
	this.score = this.root.querySelector('#score');
	this.controls = this.root.querySelector('#controls');

	this.check.addEventListener('click', () => {
	    this.check.disabled = true;
	    let sntc = document.querySelector('.sentence.active');
	    let answ = sntc.querySelector('.answer');
	    let hint = sntc.querySelector('.hint');

	    let answ_t = answ.innerText;
	    
	    let corr = JSON.parse(answ.dataset.hints).map(h => ({
		hint: h,
		corr: this.check_answer(answ_t, h),
	    })).reduce((a, b) => a.corr.errors < b.corr.errors ? a : b);
	    
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

	    answ.innerHTML = answ_str;
	    answ.classList.add(corr.corr.errors == 0 ? 'right' : 'wrong');
	    hint.innerHTML = hint_str;
	    hint.classList.add(corr.corr.errors == 0 ? 'right' : 'wrong');

	    this.errors.words += corr.corr.errors;
	    this.errors.sentences += !(corr.corr.errors == 0);
	    
	    this.render_next();
	});
	this.skip.addEventListener('click', () => {
	    this.render_next();
	});
	this.sentences.addEventListener('keyup', (e) => {
	    if (e.target.classList.contains('answer')
		&& e.target.parentNode.classList.contains('active')) {
		this.check.disabled = e.target.innerText.trim() === '';
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
	    this.root.classList.add('done');
	    for (let c of this.clips)
		this.score.innerHTML += `<p>${c.sentence[0]}</p>`;

	    let err = this.errors.words == 0
		? this.capitalize(this.lang.noerr) + '!'
		: this.errors.words == 1
		? `1 ${this.lang.error}`
		: `${this.errors.words} ${this.lang.errors}`;
	    this.score.innerHTML += `<p class="errcount">${err}</p>`;
	}
	window.scrollTo(0,document.body.scrollHeight);
    }

    check_answer(answer, hint) {
	let atok = this.tokenize(answer),
	    htok = this.tokenize(hint);
	let diff = this.diff(atok.map(x => x.token),
			     htok.map(x => x.token));

	for (let [ai, hi] of diff) {
	    atok[ai].good = htok[hi].good = true;
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
    
    tokenize(sentence, lower=true) {
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

    capitalize(s) {
	return s.charAt(0).toUpperCase() + s.substring(1, s.length);
    }
}

Deektay.main = `<div id="sentences"></div>
<div id="score"></div>
<div id="controls">
  <button id="check" disabled="true"></button>
  <button id="skip"></button>
</div>`;

Deektay.sentence = `<div class="sentence active">
  <div>
    <button class="play">▶</button>
    <p class="hint"></p>
    <audio style="display:none"></audio>
  </div>
  <p class="answer" contentEditable="true"></p>
</div>`;

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
