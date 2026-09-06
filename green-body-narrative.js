(() => {
  'use strict';

  const beats = {
    here: {
      lines: ['这里感知到了你。'],
      english: 'THIS PLACE HAS FELT YOU.',
    },
    there: {
      lines: ['你只触碰了一个地方。', '为什么远处也知道你来了？'],
      english: 'YOU TOUCHED ONE PLACE.\nWHY DID THE DISTANT BODY KNOW?',
    },
    collective: {
      lines: ['这里只是我们最先感到你的地方。', '你看到许多生命。正在感知你的，只有一个“我们”。'],
      english: 'THIS IS ONLY WHERE WE FELT YOU FIRST.',
      inspiration: {
        title: '《深渊上的火》',
        meta: '科幻小说｜Vernor Vinge',
        introduction: '一部描写多个犬形身体共同组成一个完整人格的太空歌剧。',
        connection: '一个人格，可以由多个身体共同构成。',
      },
    },
    contrast: {
      lines: ['在你们的世界，一个身体通常只有一个“我”。', '在这里，同一个“我”同时活在许多生命里。'],
      english: 'ONE BODY, ONE SELF — THAT IS YOUR USUAL WORLD.\nHERE, ONE SELF LIVES THROUGH MANY LIVES.',
      inspiration: {
        title: '《超越人类》',
        meta: '科幻小说｜Theodore Sturgeon',
        introduction: '一部讲述几个能力各异的人连接起来，共同形成一个复合生命的经典科幻小说。',
        connection: '许多个体，共同组成一个新的生命。',
      },
    },
    question: {
      lines: ['如果一个意识，可以同时生长在许多生命之中——', '那么，“我”究竟在哪里？'],
      english: 'IF ONE CONSCIOUSNESS CAN GROW THROUGH MANY LIVES —\nWHERE, THEN, AM I?',
      inspiration: {
        title: '《最后与最初的人类》',
        meta: '科幻小说｜Olaf Stapledon',
        introduction: '一部跨越漫长未来、想象人类多次演化以及超个体心智的未来史小说。',
        connection: '成员更替，超个体心智仍可延续。',
      },
    },
    human: {
      lines: ['可如果方向正好相反呢？', '如果人类社会，才是一个更缓慢、更巨大的意识？'],
      english: 'WHAT IF THE DIRECTION IS REVERSED?\nWHAT IF HUMAN SOCIETY IS THE LARGER MIND?',
      inspiration: {
        title: '《阿凡达》',
        meta: '科幻电影｜James Cameron',
        introduction: '一部描绘潘多拉生命通过自然神经网络与 Eywa 相连的科幻电影。',
        connection: '记忆被保存在一张自然神经网络之中。',
      },
    },
    final: {
      lines: ['语言会不会是它的神经？城市、网络和历史，会不会是它的记忆？', '而每一个人，只是它暂时感受世界的地方？'],
      english: 'COULD LANGUAGE BE ITS NERVES, AND HISTORY ITS MEMORY?\nCOULD EACH PERSON BE A PLACE WHERE IT BRIEFLY FEELS?',
      closing: '当你离开这里，你还会把“我”只放在这具身体里面吗？',
    },
  };

  const hints = {
    local: '移动你的感知，看看哪里会注意到你。',
    touched: '点击，把你的感知送进去。',
    network: '感知正在沿着同一个身体，去往更远的地方。',
    whole: '现在，试着从许多地方感受同一个“我”。',
  };

  const sources = [
    {
      number: '01',
      title: '《阿凡达》',
      original: 'Avatar',
      creator: 'James Cameron · 科幻电影',
      kind: '本章实际灵感 · 科幻设定',
      introduction: '一部描绘潘多拉生命通过自然神经网络与 Eywa 相连的科幻电影。',
      description: '潘多拉的记忆与生命通过自然神经网络彼此连接。它启发了本章的生态连接、生命荧光与“一个更大存在正在感知”的世界。',
      thought: '作品提出：一段记忆是否能够属于整片生态，而不只属于某个个体？',
      url: 'https://www.avatar.com/pandorapedia/the-tree-of-voices',
      linkLabel: '查看 Avatar 官方世界资料',
    },
    {
      number: '02',
      title: '《深渊上的火》',
      original: 'A Fire Upon the Deep',
      creator: 'Vernor Vinge · 科幻小说',
      kind: '延伸推荐 · 群体心智',
      introduction: '一部描写多个犬形身体共同组成一个完整人格的太空歌剧。',
      description: '书中的 Tines 不是一具身体里的一个人格：多个相隔的身体共同组成一个完整的“人”。',
      thought: '如果组成你的身体彼此分开，“你”还会存在于哪里？',
      url: 'https://us.macmillan.com/books/9781250237750/afireuponthedeep',
      linkLabel: '查看出版社介绍',
    },
    {
      number: '03',
      title: '《超越人类》',
      original: 'More Than Human',
      creator: 'Theodore Sturgeon · 科幻小说',
      kind: '延伸推荐 · 人类共同体',
      introduction: '一部讲述几个能力各异的人连接起来，共同形成一个复合生命的经典科幻小说。',
      description: '几个各自不完整的人把不同能力连接起来，成为一个可能代表人类下一阶段的单一生命。',
      thought: '作品把“共同生活”推进成更激进的问题：许多人能否构成一个新的生命主体？',
      url: 'https://www.penguinrandomhouse.com/books/175008/more-than-human-by-theodore-sturgeon/',
      linkLabel: '查看出版社介绍',
    },
    {
      number: '04',
      title: '《最后与最初的人类》',
      original: 'Last and First Men',
      creator: 'Olaf Stapledon · 科幻小说',
      kind: '延伸推荐 · 超个体意识',
      introduction: '一部跨越漫长未来、想象人类多次演化以及超个体心智的未来史小说。',
      description: '这部跨越漫长未来的人类史，想象由许多心智组成、并能在成员更替后继续存在的“超个体心智”。',
      thought: '“It will remain the same super-individual mind.”\n即使成员更替，它仍然是同一个“超个体心智”。',
      url: 'https://www.gutenberg.org/files/79003/79003-h/79003-h.htm',
      linkLabel: '阅读原文',
    },
  ];

  function appendLines(node, lines) {
    const paragraph = document.createElement('p');
    lines.forEach((line, index) => {
      if (index) paragraph.append(document.createElement('br'));
      paragraph.append(document.createTextNode(line));
    });
    node.append(paragraph);
  }

  function hydrateBeats() {
    document.querySelectorAll('[data-copy-key]').forEach((node) => {
      const copy = beats[node.dataset.copyKey];
      if (!copy) return;
      appendLines(node, copy.lines);
      if (copy.english) {
        const english = document.createElement('small');
        english.textContent = copy.english;
        node.append(english);
      }
      if (copy.inspiration) {
        const inspiration = document.createElement('aside');
        inspiration.className = 'world-one__inspiration';

        const label = document.createElement('span');
        label.textContent = '灵感来源';
        const title = document.createElement('strong');
        title.textContent = copy.inspiration.title;
        const meta = document.createElement('small');
        meta.textContent = copy.inspiration.meta;
        const introduction = document.createElement('p');
        introduction.textContent = copy.inspiration.introduction;
        const connection = document.createElement('em');
        connection.textContent = copy.inspiration.connection;

        inspiration.append(label, title, meta, introduction, connection);
        node.append(inspiration);
      }
      if (copy.closing) {
        const closing = document.createElement('blockquote');
        closing.textContent = copy.closing;
        node.append(closing);
      }
    });
  }

  function hydrateSources() {
    const list = document.getElementById('worldSourcesList');
    if (!list) return;
    sources.forEach((source) => {
      const article = document.createElement('article');
      article.className = 'world-one__source';

      const number = document.createElement('small');
      number.textContent = `灵感来源 ${source.number} · ${source.kind}`;

      const heading = document.createElement('h4');
      heading.textContent = source.title;
      const original = document.createElement('span');
      original.textContent = source.original;
      heading.append(original);

      const creator = document.createElement('p');
      creator.className = 'world-one__source-creator';
      creator.textContent = source.creator;

      const introduction = document.createElement('p');
      introduction.className = 'world-one__source-introduction';
      introduction.textContent = source.introduction;

      const description = document.createElement('p');
      description.className = 'world-one__source-description';
      description.textContent = source.description;

      const thought = document.createElement('blockquote');
      thought.textContent = source.thought;

      const link = document.createElement('a');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `${source.linkLabel} ↗`;

      article.append(number, heading, creator, introduction, description, thought, link);
      list.append(article);
    });
  }

  hydrateBeats();
  hydrateSources();
  window.GreenBodyNarrative = Object.freeze({ beats, hints, sources });
})();
