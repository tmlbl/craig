var MongoClient = require("mongodb").MongoClient,
    scraper = require("./scraper"),
    async = require("async");

var url = 'mongodb://localhost:27017/craig';
MongoClient.connect(url, function(err, db) {
  if (err) {
    throw err;
  }

  console.log("Connected correctly to server.");
  searchIndexes(db, function () {
    ingest(db, "seattle", "sss", "gun safe", function () {
      db.close();
    });
  })
});

// Text search indexes
function searchIndexes(db, callback) {
  db.collection('posts').createIndex(
      {
        content: "text",
        content: "hashed"
      },
      null,
      function(err, results) {
        if (err) {
          throw err;
        }
         console.log(results);
         callback();
      }
   );
}

function ingest(db, region, category, query, callback) {
  scraper.search(region, category, query, function (posts) {
    async.each(posts, function (post, postCallback) {
      db.collection("posts").insertOne(post, postCallback);
    }, callback);
  });
}
