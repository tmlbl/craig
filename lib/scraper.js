var request = require("request"),
    htmlparser = require("htmlparser2"),
    fs = require("fs"),
    path = require("path"),
    async = require("async"),
    program = require("commander"),
    gutil = require("gulp-util");

const PARALLELISM = 40;

function extractPostLinks(content) {
  var postlinks = [];
  var parser = new htmlparser.Parser({
    onopentag: function (name, attribs) {
      if (attribs.class == "hdrlnk") {
        postlinks.push(attribs.href);
      }
    },
    ontext: function (text) {

    },
    onclosetag: function (tagname) {

    }
  }, {decodeEntities: true});

  parser.write(content);
  parser.end();
  return postlinks;
}

function baseUrl(region) {
  return "http://" + region + ".craigslist.org";
}

function makeUrl(region, category, query, pagenum) {
  return baseUrl(region) + "/search/" + category +
      "?query=" + query + (pagenum == 0 ? "" : "&s=" + pagenum * 100);
}

// Recursively get page links
function getPostLinks(region, category, query, cb) {
  gutil.log("Getting search results...")
  var links = [];
  var count = 20;
  var pagenum = 0;

  async.whilst(
    function () { return count != 0 },
    function (callback) {
      var url = makeUrl(region, category, query, pagenum);
      // gutil.log(url);
      request.get(url, function (err, res, body) {
        if (err) {
          return cb(err);
        }
        var pageLinks = extractPostLinks(body);
        count = pageLinks.length;
        pageLinks.forEach(function (l) { links.push(baseUrl(region) + l) });
        pagenum++;
        callback(null, count);
      });
    },
    function (err, n) {
        cb(err, links);
    }
  );
}

function Post() {
  return {
    timestamp: new Date(),
    images: [],
    content: ""
  }
}

function chopurl(url) { return url.substring(/\.org/.exec(url).index+5) }

function extractPost(content) {
  var in_post = false,
      lines = [],
      post = Post();

  var parser = new htmlparser.Parser({
    onopentag: function (name, attribs) {
      if (attribs.id == "postingbody") {
        in_post = true;
      }

      if (attribs.class == "thumb") {
        post.images.push(chopurl(attribs.href));
      }

      if (name == "time") {
        post.timestamp = new Date(attribs.datetime);
      }
    },
    ontext: function (text) {
      if (in_post) {
        lines.push(text);
      }

      if (text.indexOf("post id") != -1) {
        post._id = parseInt(text.split(' ')[2]);
      }
    },
    onclosetag: function (tagname) {
      if (in_post && tagname == "section") {
        in_post = false;
        post.content = lines.join();
      }
    }
  }, {decodeEntities: true});

  parser.write(content);
  parser.end();
  return post;
}

function getImage(imageName, cb) {
  // gutil.log(imageName);
  var filename = process.env.HOME + "/.craig/images/" + imageName,
      url = "http://images.craigslist.org/" + imageName;

  if (fs.existsSync(filename)) { return cb() }

  request(url).on("response",  function (res) {
    res.pipe(fs.createWriteStream(filename)).on("finish", cb);
  });
}

function getPosts(links, postsCallback) {
  var sets = [];
  var set = [];
  var posts = [];
  var done = 0;

  links.forEach(function (l) {
    if (set.length >= PARALLELISM) {
      sets.push(set);
      set = [];
    } else {
      set.push(l);
    }
  });

  if (set.length > 0) { sets.push(set) }

  gutil.log("Scraping post contents...");
  async.eachSeries(sets, function (set, setCallback) {
    gutil.log(Math.floor((done / links.length) * 100) + "% done...");
    done += PARALLELISM;
    async.each(set, function (posturl, postCallback) {
      request.get(posturl, function (err, response, body) {
        var post = extractPost(body);
        async.each(post.images, function (imageName, imgCallback) {
          getImage(imageName, imgCallback);
        }, postCallback);
        if (post.content) {
          posts.push(post);
        }
      });
    }, setCallback);
  }, function () {
    postsCallback(posts);
  });

}

module.exports.search = function (region, category, query, cb) {
  gutil.log("Searching for", query, "in", region);
  getPostLinks(region, category, query, function (err, links) {
    gutil.log("Got", links.length, "results");
    getPosts(links, function (posts) {
      posts = posts.map(function (p) {
        p.query = query;
        p.region = region;
        return p;
      });
      cb(posts);
    });
  });
}
