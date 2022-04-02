const htmlParser = require("node-html-parser");
const fetch = require("node-fetch");
var xmlParser = require('xml2js');
const fs = require("fs");
const { resolve } = require("path");
var sources ;
var sourcesToPull ;
var articles = [];


// const { sources, sourcesToPull } = require("./sources.json")
var sources ;

/**
 * 
 * @param {Source} source 
 */
 exports.scanFrom = 
    async function scanFrom(source, articlesPath, sourceName) {
        return new Promise(resolve => {
            if(articlesPath == undefined || articlesPath == "default") {
                articlesPath = [
                    "rss",
                    "channel",
                    0,
                    "item"
                ]
            }
            resolve(getArticlesFrom(source, articlesPath, sourceName));
        })

     }

/**
 * Get articles from a source (works only with RSS XML)
 * @param {String} source 
 * @returns {Array} articles array
 */
async function getArticlesFrom(sourceURL, articlesPath, sourceName) {
        var xmlPage = await getXmlOnURL(sourceURL);
        var currentXMLLocation = xmlPage;

        //goes down the XML (naviguation basically)
        for (let i = 0; i < articlesPath.length; i++) {
            const newSubPath = articlesPath[i];
            currentXMLLocation = currentXMLLocation[newSubPath];
        }
        //max articles (here 1)
        var maxArticles = currentXMLLocation.length;
        if(maxArticles > 1) {
            maxArticles = 1;
        }

        //send out the article in an object
        return new Promise(resolve => {
            for (let i = 0; i < maxArticles+1; i++) {
                if(i == maxArticles) {
                    resolve(articles);
                    return;
                } else {
                    const articleObj = currentXMLLocation[i];
                    var article = new Article(articleObj.title[0], articleObj.description[0], articleObj.pubDate[0], sourceName, articleObj.link[0])
                    article = {title: articleObj.title[0], description: articleObj.description[0], dateOfPublication: articleObj.pubDate[0], author: sourceName, linkToArticle: articleObj.link[0]};
                    articles.push(article);
                }
            }
        })


    
          
            
}



/**
 * Get the xml from a URL and parse it
 * @param {String} url 
 * @returns {Object} rawArticleObject
 */
async function getXmlOnURL(url) {

    return new Promise(resolve => {
            fetch(url)
            .then(res => 
                res.text()
            )
            .then(text => {
                var parsedXML ;
                 xmlParser.parseString(text, (err, result) => {
                    parsedXML = result;
                });
                resolve(parsedXML);
            });
    });
    
}


class Article {

    constructor(title, description, dateOfPublication, author, linkToArticle) {
        this.title = title;
        this.description = description;
        this.dateOfPublication = dateOfPublication;
        this.author = author;
        this.linkToArticle = linkToArticle;
    }

}

module.exports.Article = Article;

class Source {
    constructor(name, url, articlesPath, mode) {
        this.name = name;
        this.url = url;
        this.articlesPath = articlesPath;
        this.mode = mode;
    }
}