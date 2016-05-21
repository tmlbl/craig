var DB = require("tingodb")().Db,
    scraper = require("./scraper"),
    async = require("async"),
    fs = require("fs-extra");

var db = {};

module.exports.init = function (dbDir) {
  db = new DB(dbDir, {});
}

module.exports.ingest = function (region, category, query, callback) {
  scraper.search(region, category, query, function (posts) {
    async.each(posts, function (post, postCallback) {
      db.collection("posts").insert(post, postCallback);
    }, callback);
  });
}

module.exports.search = function (query, callback) {
  db.collection("posts", function (err, coll) {
    coll.ensureIndex({
      content: "text"
    }, function (err) {
      if (err) { throw err }
      coll.find({
        $text: { $search: query }
      }, function (err, cursor) {
        if (err) { throw err }
        cursor.toArray(callback);
      })
    })
  })
}
