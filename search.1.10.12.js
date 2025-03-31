(function () {
  /**
   * Converts a colon formatted string to a object with properties.
   */
  function getAndRemoveConfig(str) {
    if (str === void 0) str = "";
    var config = {};
    if (str) {
      str = str
        .replace(/^('|")/, "")
        .replace(/('|")$/, "")
        .replace(/(?:^|\s):([\w-]+:?)=?([\w-%]+)?/g, function (m, key, value) {
          if (key.indexOf(":") === -1) {
            config[key] = (value && value.replace(/&quot;/g, "")) || true;
            return "";
          }
          return m;
        })
        .trim();
    }
    return { str: str, config: config };
  }

  function removeDocsifyIgnoreTag(str) {
    return str
      .replace(/<!-- {docsify-ignore} -->/, "")
      .replace(/{docsify-ignore}/, "")
      .replace(/<!-- {docsify-ignore-all} -->/, "")
      .replace(/{docsify-ignore-all}/, "")
      .trim();
  }

  /* eslint-disable no-unused-vars */
  var INDEXS = {};

  var LOCAL_STORAGE = {
    EXPIRE_KEY: "docsify.search.expires",
    INDEX_KEY: "docsify.search.index",
  };

  function resolveExpireKey(namespace) {
    return namespace ? LOCAL_STORAGE.EXPIRE_KEY + "/" + namespace : LOCAL_STORAGE.EXPIRE_KEY;
  }

  function resolveIndexKey(namespace) {
    return namespace ? LOCAL_STORAGE.INDEX_KEY + "/" + namespace : LOCAL_STORAGE.INDEX_KEY;
  }

  function escapeHtml(string) {
    var entityMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return String(string).replace(/[&<>"']/g, function (s) {
      return entityMap[s];
    });
  }

  function getAllPaths(router) {
    var paths = [];
    Docsify.dom
      .findAll(".sidebar-nav a:not(.section-link):not([data-nosearch])")
      .forEach(function (node) {
        var href = node.href;
        var originHref = node.getAttribute("href");
        var path = router.parse(href).path;
        if (path && paths.indexOf(path) === -1 && !Docsify.util.isAbsolutePath(originHref)) {
          paths.push(path);
        }
      });
    return paths;
  }

  function getTableData(token) {
    if (!token.text && token.type === "table") {
      token.cells.unshift(token.header);
      token.text = token.cells
        .map(function (rows) {
          return rows.join(" | ");
        })
        .join(" |\n ");
    }
    return token.text;
  }

  function getListData(token) {
    if (!token.text && token.type === "list") {
      token.text = token.raw;
    }
    return token.text;
  }

  function saveData(maxAge, expireKey, indexKey) {
    localStorage.setItem(expireKey, Date.now() + maxAge);
    localStorage.setItem(indexKey, JSON.stringify(INDEXS));
    console.log("[Search] Saved custom index data to localStorage under key:", indexKey);
  }

  function genIndex(path, content, router, depth) {
    if (content === void 0) content = "";
    var tokens = window.marked.lexer(content);
    var slugify = window.Docsify.slugify;
    var index = {};
    var slug;
    var title = "";
    tokens.forEach(function (token, tokenIndex) {
      if (token.type === "heading" && token.depth <= depth) {
        var ref = getAndRemoveConfig(token.text);
        var str = ref.str;
        var config = ref.config;
        var text = removeDocsifyIgnoreTag(token.text);
        if (config.id) {
          slug = router.toURL(path, { id: slugify(config.id) });
        } else {
          slug = router.toURL(path, { id: slugify(escapeHtml(text)) });
        }
        if (str) {
          title = removeDocsifyIgnoreTag(str);
        }
        index[slug] = { slug: slug, title: title, body: "" };
      } else {
        if (tokenIndex === 0) {
          slug = router.toURL(path);
          if (!index[slug]) {
            index[slug] = { body: "" };
          }
          index[slug].body += "\n" + (token.text || "");
        }
        if (!slug) {
          return;
        }
        if (!index[slug]) {
          index[slug] = { slug: slug, title: "", body: "" };
        } else if (index[slug].body) {
          token.text = getTableData(token);
          token.text = getListData(token);
          if (!index[slug]) {
            index[slug] = { body: "" };
          }
          index[slug].body += "\n" + (token.text || "");
        } else {
          token.text = getTableData(token);
          token.text = getListData(token);
          index[slug].body = token.text || "";
        }
      }
    });
    slugify.clear();
    console.log("[Search] Generated index for", path, ":", index);
    return index;
  }

  function ignoreDiacriticalMarks(keyword) {
    if (keyword && keyword.normalize) {
      return keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    return keyword;
  }

  /**
   * @param {String} query Search query
   * @returns {Array} Array of results
   */
  function search(query) {
    var matchingResults = [];
    var data = [];
    Object.keys(INDEXS).forEach(function (key) {
      data = data.concat(
        Object.keys(INDEXS[key]).map(function (page) {
          return INDEXS[key][page];
        })
      );
    });
    query = query.trim();
    var keywords = query.split(/[\s\-，\\/]+/);
    if (keywords.length !== 1) {
      keywords = [].concat(query, keywords);
    }
    var loop = function (i) {
      var post = data[i];
      var matchesScore = 0;
      var resultStr = "";
      var handlePostTitle = "";
      var handlePostContent = "";
      var postTitle = post.title && post.title.trim();
      var postContent = post.body && post.body.trim();
      var postUrl = post.slug || "";
      function stripMarkdownAndHTML(content) {
        content = content.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
        content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
        content = content.replace(/(\*\*|__)(.*?)\1/g, "$2");
        content = content.replace(/(\*|_)(.*?)\1/g, "$2");
        content = content.replace(/(\*\*\*|___)(.*?)\1/g, "$2");
        content = content.replace(/^#{1,6}\s*(.*)$/gm, "$1");
        content = content.replace(/^\s*[-*+]\s+/gm, "");
        content = content.replace(/^\s*\d+\.\s+/gm, "");
        content = content.replace(/^\s*>+\s*/gm, "");
        content = content.replace(/<\/?[^>]+(>|$)/g, "");
        return content.trim();
      }
      postContent = stripMarkdownAndHTML(postContent);
      if (
        postContent.includes("iframe") ||
        postContent.includes(":fas") ||
        postContent.includes(":fab") ||
        postContent.includes("embedly-card")
      ) {
        return;
      }
      if (!postTitle && !postContent) {
        return;
      }
      if (postTitle) {
        keywords.forEach(function (keyword) {
          var regEx = new RegExp(
            escapeHtml(ignoreDiacriticalMarks(keyword)).replace(/[|\\{}()[\]^$+*?.]/g, "\\$&"),
            "gi"
          );
          var indexTitle = postTitle ? escapeHtml(ignoreDiacriticalMarks(postTitle)).search(regEx) : -1;
          var indexContent = postContent ? escapeHtml(ignoreDiacriticalMarks(postContent)).search(regEx) : -1;
          if (indexTitle >= 0 || indexContent >= 0) {
            matchesScore += indexTitle >= 0 ? 3 : indexContent >= 0 ? 2 : 0;
            if (indexContent < 0) indexContent = 0;
            var start = indexContent < 11 ? 0 : postContent.lastIndexOf(" ", indexContent - 10);
            var end = start === 0 ? 70 : postContent.indexOf(" ", indexContent + keyword.length + 60);
            if (end === -1) {
              end = postContent.length;
            }
            var matchContent = escapeHtml(ignoreDiacriticalMarks(postContent))
              .substring(start, end)
              .replace(regEx, function (word) {
                return "<em class=\"search-keyword\">" + word + "</em>";
              }) + "...";
            resultStr += matchContent;
          }
        });
        if (matchesScore > 0) {
          matchingResults.push({
            title: escapeHtml(ignoreDiacriticalMarks(postTitle)),
            content: resultStr || postContent,
            url: postUrl,
            score: matchesScore,
          });
        }
      }
    };
    for (var i = 0; i < data.length; i++) {
      loop(i);
    }
    return matchingResults.sort(function (r1, r2) {
      return r2.score - r1.score;
    });
  }

  function init(config, vm) {
    var paths = config.paths;
    var expireKey = resolveExpireKey(config.namespace);
    var indexKey = resolveIndexKey(config.namespace);
    // Force a fresh index (clear any stored index)
    localStorage.removeItem(indexKey);
    INDEXS = {};
    console.log("[Search] Building custom index for paths:", paths);
    var len = paths.length;
    var count = 0;
    paths.forEach(function (path) {
      Docsify.get(vm.router.getFile(path), false, vm.config.requestHeaders).then(function (result) {
        INDEXS[path] = genIndex(path, result, vm.router, config.depth);
        count++;
        if (count === len) {
          saveData(config.maxAge, expireKey, indexKey);
          console.log("[Search] Finished building custom index.");
        }
      });
    });
  }

  function init$1(opts, vm) {
    var keywords = vm.router.parse().query.s;
    updateOptions(opts);
    style();
    tpl(keywords);
    bindEvents();
    if (keywords) {
      setTimeout(function () {
        doSearch(keywords);
      }, 500);
    }
  }

  function style() {
    var code =
      "\n.sidebar { padding-top: 0; }\n\n.search { margin-bottom: 20px; padding: 6px; border-bottom: 1px solid #eee; }\n\n.search .input-wrap { display: flex; align-items: center; }\n\n.search .results-panel { display: none; }\n\n.search .results-panel.show { display: block; }\n\n.search input { outline: none; border: none; width: 100%; padding: 0.6em 7px; font-size: inherit; border: 1px solid transparent; }\n\n.search input:focus { box-shadow: 0 0 5px var(--theme-color, #42b983); border: 1px solid var(--theme-color, #42b983); }\n\n.search input::-webkit-search-decoration, .search input::-webkit-search-cancel-button, .search input { -webkit-appearance: none; -moz-appearance: none; appearance: none; }\n\n.search input::-ms-clear { display: none; height: 0; width: 0; }\n\n.search .clear-button { cursor: pointer; width: 36px; text-align: right; display: none; }\n\n.search .clear-button.show { display: block; }\n\n.search .clear-button svg { transform: scale(.5); }\n\n.search h2 { font-size: 17px; margin: 10px 0; }\n\n.search a { text-decoration: none; color: inherit; }\n\n.search .matching-post { border-bottom: 1px solid #eee; }\n\n.search .matching-post:last-child { border-bottom: 0; }\n\n.search p { font-size: 14px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }\n\n.search p.empty { text-align: center; }\n\n.app-name.hide, .sidebar-nav.hide { display: none; }";
    Docsify.dom.style(code);
  }

  // Updated tpl(): Create a container using plain DOM methods.
  function tpl(defaultValue) {
    if (defaultValue === void 0) defaultValue = "";
    var html =
      '<div class="input-wrap">' +
        '<input type="search" value="' + defaultValue + '" aria-label="Search text" />' +
        '<div class="clear-button">' +
          '<svg width="26" height="24">' +
            '<circle cx="12" cy="12" r="11" fill="#ccc" />' +
            '<path stroke="white" stroke-width="2" d="M8.25,8
