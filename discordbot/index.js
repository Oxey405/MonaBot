const { token, weather_api_key, exchangerate_api_key } = require('./config.json');
const { departements } = require('./departements-list.json');
// Require the necessary discord.js classes
const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { scanFrom, Article } = require("../news_scrapper/scanner");
const { Client, Intents, MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu, Emoji, Guild, BaseGuildEmoji, User, DMChannel } = require('discord.js');
const fetch = require("node-fetch");
const {sources, sourcesToPull} = require("./sources.json")
const fs = require("fs");
const os = require("os");

const pathToDB = os.homedir() + "/monabot_sub_users.json";
    
let currenciesValues;
let cryptoValues = [];
const userCooldown = {};
let subscribedUsers = {};
let articles = [];

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.DIRECT_MESSAGES, "DIRECT_MESSAGES"], partials: ["CHANNEL"] });

/**
 * Get 5 articles from the news sources.
 */
async function getArticles() {
    console.log("getting articles")
    for (let i = 0; i < sourcesToPull.length; i++) {
        const source = sources[sourcesToPull[i]];

        console.log("pulling from : " + source.url);
        var articlesFromSource = await scanFrom(source.url, undefined , source.name );
        // for (let i = 0; i < articlesFromSource.length; i++) { deprecated because 1 article per source.
            const article = articlesFromSource[i];
            articles.push(article);

        //}
    }
}

/**
 * Set the currencies values for USD, GBP, JPY and EUR.
 * Default values are set to "EUR".
 * @param {*} currency_id 
 */
function setValueOfCurrenciesFrom(currency_id = "EUR") {
    
    // fetch the currencies values from the exchangerate api
    fetch(`https://v6.exchangerate-api.com/v6/${exchangerate_api_key}/latest/${currency_id}`)
    .then(res => 
        res.json()
    )
    .then(json => {
        // Set the currencies values in the currenciesValues variable.
        currenciesValues = {USD: json.conversion_rates.USD, GBP: json.conversion_rates.GBP, JPY: json.conversion_rates.JPY, EUR: json.conversion_rates.EUR} ;
    })
    .catch(function(error) {
        console.log(`Cant fetch currencies values from the exchangerate api : ${error.message}`);
    }) ;


    fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=EUR&ids=bitcoin,dogecoin&order=market_cap_desc&sparkline=false&price_change_percentage=24h`)
    .then(res => 
        res.json()
    )
    .then(listCoin => {
        cryptoValues = [];
        listCoin.forEach(coin => {
            cryptoValues.push({"NAME": coin.name, "PRICE" : coin.current_price, "HIGH" : coin.high_24h, "LOW" : coin.low_24h, "PERCENTAGE" :coin.market_cap_change_percentage_24h});
            //console.log(`name : ${coin.name}, price : ${coin.current_price}, high_24h : ${coin.high_24h}, low_24h : ${coin.low_24h}, market_cap_change_percentage_24h : ${coin.market_cap_change_percentage_24h}`);
        });
    })
    .catch(function(error) {
        console.log(`Cant fetch crypto values from coingecko api : ${error.message}`);
    }) ;
}

getArticles();// Get last articles on bot init.

// Create loop to get last articles and currencies data every 1 hour.
setInterval(() => {
    articles = [];
    try {
        getArticles();
        setValueOfCurrenciesFrom('EUR');

    } catch (error) {
        console.log("error while pulling articles : " + error)
    }

}, 3600000) // updates every hour (3600000 ms)


// When the client is ready, run this code (only once)
client.once('ready', () => {
    setValueOfCurrenciesFrom("EUR");

    // Set the client user's activity
    client.user.setActivity('les actus, météo et autres', { type: "WATCHING"});

	console.log('Ready!');
    var lastDayDone = new Date().getUTCDay()-1;

    // Loop for detect time and send daily journal to users.
    setInterval(() => {

        var date = new Date(); //Get current date.
        date.setHours(date.getHours() + 2); //Add 2 hours to current date to get UTC+2 date.

        if(date.getUTCHours() == 6 && lastDayDone < date.getUTCDay() && date.getUTCMinutes() <= 1) { 
            getArticles(); //Get last articles

            //For each user subscribed to the bot, send them daily journal.
            subscribedUsers.users.forEach((user) => {
               sendJournalTo(user);
           })
        }

        //Set bot status every day from 21:00 to 06:00 idle
        if(date.getUTCHours() > 21 || date.getUTCHours() <= 6) {
            client.user.setStatus('idle');
        } else client.user.setStatus('online'); //Set bot status to online

    }, 61000) // checks every minute and 10secs (61000 ms)
});

client.on('messageCreate', async message => {
    console.log(message.content);
    if(message.content.startsWith('!meteo')) {
        if(message.content.replace("!meteo", "") == "") {
            await message.reply("Désolé, mais ce que vous avez envoyé n'est pas un nombre valide.")
            return;

        }
        try {
            var zipcode_depart = parseInt(message.content.replace("!meteo", ""));
            console.log(zipcode_depart);
        } catch (error) {
            await message.reply("Désolé, mais ce que vous avez envoyé n'est pas un nombre valide.")
            return;
        }
        if(zipcode_depart == NaN) {
            await message.reply("Désolé, mais ce que vous avez envoyé n'est pas un nombre valide.")
            return;
        }
        if(zipcode_depart == undefined) {
            await message.reply("Désolé, mais ce que vous avez envoyé n'est pas un nombre valide.")

        }
        if(userCooldown[message.author.id] != undefined) {
            if(userCooldown[message.author.id] > Date.now()) {
                await message.reply("Veuillez attendre une minute avant de recommencer.")
                return;
            } else {
                delete userCooldown[message.author.id];
            }
        } else {
            userCooldown[message.author.id] = Date.now()+60000;
        }
        var temp = "pas de température trouvée..."
        var depart_name = departements[zipcode_depart];
        if(zipcode_depart >= 971 && zipcode_depart <= 976) {   
            depart_name = "Outre mer"
        }
        if(zipcode_depart < 0 || (zipcode_depart > 95 && zipcode_depart < 971) || zipcode_depart > 976) {
            await message.reply("Ce département n'existe pas");
            return;
        }
        // Weather embed 1
        var WeatherEmbed;
        //first get the biggest city in the departement
        getBiggestCityOnDepartment(zipcode_depart).then(cityInfo => {
            //get current weather
            getWeatherDataFrom(cityInfo.codesPostaux[0]).then(weather => {
                var emojiState = ":question:";
                var stateText;
                if(weather.state == "Clouds") {
                    emojiState = ":cloud:";
                    weather.desc = "nuageux";
                }
                if(weather.state == "Clear") {
                    emojiState = ":sun_with_face:"
                    weather.desc = "ensoleillé"
                }
                if(weather.state == "Mist") {
                    emojiState = ":white_sun_small_cloud:"
                    weather.desc = "brumeux";
                }
                if(weather.state == "Rain") {
                    emojiState = ":cloud_rain:";
                    weather.desc = "pluvieux";
                }

                getForecastDataFrom(cityInfo.codesPostaux[0]).then(forecast => {
                    getRandomFieldsPhoto().then(photoURL => {

                        var emojiStateForecast = ":question:";
                    var stateText;
                    if(forecast.state == "Clouds") {
                        emojiStateForecast = ":cloud:";
                        forecast.desc = "nuageux";
                    }
                    if(forecast.state == "Clear") {
                        emojiStateForecast = ":sun_with_face:"
                        forecast.desc = "ensoleillé"
                    }
                    if(forecast.state == "Mist") {
                        emojiStateForecast = ":white_sun_small_cloud:"
                        forecast.desc = "brumeux";
                    }
                    if(forecast.state == "Rain") {
                        emojiStateForecast = ":cloud_rain:";
                        forecast.desc = "pluvieux";
                    }
                    WeatherEmbed = new MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle('Mona Météo :satellite:')
                    .setAuthor({ name: 'MonaBot', 'iconURL':'https://cdn.discordapp.com/app-icons/958405000101519372/2f4f565eb1a8418f0b95deb28776723b.png?size=512' })
                    .setDescription('Laissez-moi vérifier en ' + depart_name + ` (${zipcode_depart}) Ville : ${cityInfo.nom}`)
                    .addFields(
                        { name: `Température actuelle dans le ${zipcode_depart}`, value : `:thermometer: ${weather.temp}°C ressenti ${weather.feels_temp} °C\r\n`},
                        { name: `Météo actuelle dans le ${zipcode_depart}`, value : `Le temps est **${weather.desc}** ${emojiState}\r\n\r\n`})
                    .setImage(photoURL)
                    .addFields(
                        { name: `Prévisions dans 6h dans le ${zipcode_depart}`, value : `:thermometer: ${forecast.temp}°C ressenti ${forecast.feels_temp} °C\r\n`},
                        { name: `Prévisions dans 6h dans le ${zipcode_depart}`, value : `Le temps sera **${forecast.desc}** ${emojiStateForecast}`})
                    .setTimestamp()
                    .setFooter({ text: 'MonaBot météo fonctionne avec openweathermap.org et geo.api.gouv.fr', iconURL: 'https://openweathermap.org/themes/openweathermap/assets/img/mobile_app/android-app-top-banner.png' });
                    
                    message.reply({ embeds: [WeatherEmbed]});


                    })
                })
            })  
        })
    }
})

client.on('interactionCreate', async interaction => {

	const { commandName, componentType } = interaction;

	if (commandName === 'mona') {
		await interaction.reply({content:`Je suis là !`});

	} else if (commandName === 'meteo') {
        
        if(userCooldown[interaction.user.id] != undefined) {

            if(userCooldown[interaction.user.id] > Date.now()) {
                await interaction.reply("Veuillez attendre une minute avant de recommencer.")
                return;
            } else {
                delete userCooldown[interaction.user.id];
            }
        } else {
            userCooldown[interaction.user.id] = Date.now()+60000;
        }
        var temp = "pas de température trouvée..."
        var zipcode_depart = interaction.options.getString('zipcode');
        var depart_name = departements[zipcode_depart];
        if(zipcode_depart >= 971 && zipcode_depart <= 976) {   
            depart_name = "Outre mer"
        }
        if(zipcode_depart < 0 || (zipcode_depart > 95 && zipcode_depart < 971) || zipcode_depart > 976) {
            await interaction.reply("Ce département n'existe pas");
            return;
        }
        // Weather embed 1
        var WeatherEmbed;
            
            
        //first get the biggest city in the departement
        getBiggestCityOnDepartment(zipcode_depart).then(cityInfo => {
            //get current weather
            getWeatherDataFrom(cityInfo.codesPostaux[0]).then(weather => {
                var emojiState = ":question:";
                var stateText;
                if(weather.state == "Clouds") {
                    emojiState = ":cloud:";
                    weather.desc = "nuageux";
                }
                if(weather.state == "Clear") {
                    emojiState = ":sun_with_face:"
                    weather.desc = "ensoleillé"
                }
                if(weather.state == "Mist") {
                    emojiState = ":white_sun_small_cloud:"
                    weather.desc = "brumeux";
                }
                if(weather.state == "Rain") {
                    emojiState = ":cloud_rain:";
                    weather.desc = "pluvieux";
                }

                getForecastDataFrom(cityInfo.codesPostaux[0]).then(forecast => {
                    var emojiStateForecast = ":question:";
                    var stateText;
                    if(forecast.state == "Clouds") {
                        emojiStateForecast = ":cloud:";
                        forecast.desc = "nuageux";
                    }
                    if(forecast.state == "Clear") {
                        emojiStateForecast = ":sun_with_face:"
                        forecast.desc = "ensoleillé"
                    }
                    if(forecast.state == "Mist") {
                        emojiStateForecast = ":white_sun_small_cloud:"
                        forecast.desc = "brumeux";
                    }
                    if(forecast.state == "Rain") {
                        emojiStateForecast = ":cloud_rain:";
                        forecast.desc = "pluvieux";
                    }
                    getRandomFieldsPhoto()
                    .then(photoURL => {
                        WeatherEmbed = new MessageEmbed()
                        .setColor('#0099ff')
                        .setTitle('Mona Météo :satellite:')
                        .setAuthor({ name: 'MonaBot', 'iconURL':'https://cdn.discordapp.com/app-icons/958405000101519372/2f4f565eb1a8418f0b95deb28776723b.png?size=512' })
                        .setDescription('Laissez-moi vérifier en ' + depart_name + ` (${zipcode_depart}) Ville : ${cityInfo.nom}`)
                        .addFields(
                            { name: `Température actuelle dans le ${zipcode_depart}`, value : `:thermometer: ${weather.temp}°C ressenti ${weather.feels_temp} °C\r\n`},
                            { name: `Météo actuelle dans le ${zipcode_depart}`, value : `Le temps est **${weather.desc}** ${emojiState}\r\n\r\n`})
                        .setImage(photoURL)
                        .addFields(
                            { name: `Prévisions dans 6h dans le ${zipcode_depart}`, value : `:thermometer: ${forecast.temp}°C ressenti ${forecast.feels_temp} °C\r\n`},
                            { name: `Prévisions dans 6h dans le ${zipcode_depart}`, value : `Le temps sera **${forecast.desc}** ${emojiStateForecast}`})
                        .setTimestamp()
                        .setFooter({ text: 'MonaBot météo fonctionne avec openweathermap.org et geo.api.gouv.fr', iconURL: 'https://openweathermap.org/themes/openweathermap/assets/img/mobile_app/android-app-top-banner.png' });
                        
                        interaction.reply({ embeds: [WeatherEmbed]});
                    })
                   
                })
            })
              
        })

	} else if (commandName === 'pain') {
        await interaction.reply('Voilà du **PAIN**');
        for (let i = 0; i < 4; i++) {
            interaction.channel.send(":french_bread: :bread:");
        }
        

	}
    else if (commandName === 'actus') {

        var actusEmbed = new MessageEmbed()
        .setColor('#0099ff')
        .setTitle('Mona Actus :newspaper:')
        .setAuthor({ name: 'MonaBot', 'iconURL':'https://cdn.discordapp.com/app-icons/958405000101519372/2f4f565eb1a8418f0b95deb28776723b.png?size=512' })
        .setDescription('Dernières actualités en France (mise à jour toute les heures)')
        .addFields({ name: `A propos des actualités`, value : `Mona a trouvé ${articles.length} articles provenant de flux RSS de sites d'actus français.\r\n Ces informations ne sont pas vérifiées par MonaBot !`})
        .setTimestamp()
        .setFooter({ text: 'MonaBot actus utilise différents flux RSS', iconURL: 'https://cdn.discordapp.com/app-icons/958405000101519372/2f4f565eb1a8418f0b95deb28776723b.png?size=512' });

        for (let i = 0; i < articles.length; i++) {
            const currentArticle = articles[i];
            //formattedArticle = `**${currentArticle.title}**(${currentArticle.author})\r\nLisez l'article complet : ${currentArticle.linkToArtic   le}`
            actusEmbed.addFields({ name: `${currentArticle.title}\r\n(${currentArticle.author})`, value : 'Lisez l\'article complet sur ' + currentArticle.linkToArticle + "\r\n" +  currentArticle.description});
        }
      
        interaction.reply({ embeds: [actusEmbed]});
   
    }
    else if (commandName === 'journalmatinal') {
        var activatedJournal = new MessageEmbed()
        .setColor('#0099ff')
        .setTitle('Journal matinal Mona activé ! :newspaper:')
        .setAuthor({name: 'MonaBot', 'iconURL': 'https://cdn.discordapp.com/app-icons/958405000101519372/2f4f565eb1a8418f0b95deb28776723b.png?size=512'})
        .setDescription('Vous avez activé le journal matinal MonaBot ! Vous receverez le journal matinal tous les jours à 6 heures.')
        .addFields({ name: 'Comment ça marche ?', value : 'Tous les matins à 6h, je vous enverrais la météo du jour,\r\nles nouvelles venant de plusieurs sources et\r\ndes informations financières telle que la bourse.'})
        .setTimestamp()
        .setFooter({text: 'MonaBot journal matinal', iconURL:'https://cdn.discordapp.com/app-icons/958405000101519372/2f4f565eb1a8418f0b95deb28776723b.png?size=512'})
       
        var userDMChannel = await interaction.user.createDM();
        userDMChannel.send({content:":sparkles: **Bonjour !** Le **journal matinal** arrivera chaque jour à **6h** !:sparkles:", embeds: [activatedJournal]}); //
        interaction.reply({content: "Je vous enverrais un message tout les matins à 6h (heure française)", ephemeral: true});
        addUserToNewspaperSubscribers(interaction.user);
    }
    if(commandName === 'testjournal') {
        getArticles();
        subscribedUsers.users.forEach((user) => {
           sendJournalTo(user);

       })        
       await interaction.reply("testing...");
    }
});


// Login to Discord with your client's token
client.login(token);



async function getWeatherDataFrom(depart_code) {
    var weatherInDepartement = {
        city:"",
        temp:"",
        state:"",
        windspeed:"",
        feels_temp:"",
        desc:""
    };

    return new Promise(resolve => {
        fetch(`https://api.openweathermap.org/data/2.5/weather?zip=${depart_code},fr&appid=${weather_api_key}&units=metric&lang=fr`)
        .then(res => 
            res.json()
        )
        .then(json => {
            weatherInDepartement.city = json.name;
            weatherInDepartement.temp = json.main.temp;
            weatherInDepartement.feels_temp = json.main.feels_like;
            weatherInDepartement.state = json.weather[0].main;
            weatherInDepartement.windspeed = json.wind.speed;
            weatherInDepartement.desc = json.weather[0].description;
            resolve(weatherInDepartement);

        })
    });
    
}


async function getForecastDataFrom(depart_code) {
    var forecastInDepartement = {
        temp:"",
        state:"",
        windspeed:"",
        feels_temp:"",
        desc:""
    };

    return new Promise(resolve => {
        fetch(`https://api.openweathermap.org/data/2.5/forecast?zip=${depart_code},fr&appid=${weather_api_key}&units=metric&lang=fr&cnt=2`)
        .then(res => 
            res.json()
        )
        .then(json => {
            forecastInDepartement.temp = json.list[1].main.temp; //1 gets the weather in 6 hours
            forecastInDepartement.feels_temp = json.list[1].main.feels_like;
            forecastInDepartement.state = json.list[1].weather[0].main;
            forecastInDepartement.windspeed = json.list[1].wind.speed;
            forecastInDepartement.desc = json.list[1].weather[0].description;
            resolve(forecastInDepartement);

        })
    });
    
}

async function getBiggestCityOnDepartment(depart_code) {

    return new Promise(resolve => {
        fetch(`https://geo.api.gouv.fr/departements/${depart_code}/communes`)
        .then(res => 
            res.json()
        )
        .then(json => {
            //extract the most populated one (could be ressource intensive for now.)
            var biggestCityPop = 0;
            var biggestCity = "";
            var biggestCityJSON ;
            for (let i = 0; i < json.length; i++) {
                const city = json[i];
                if(city.population > biggestCityPop) {
                    biggestCity = city.codesPostaux[0];
                    biggestCityPop = city.population;
                    biggestCityJSON = city;
                }
            }
            resolve(biggestCityJSON);
        })
    });
    
}
/**
 * 
 * @param {User} user 
 */
async function addUserToNewspaperSubscribers(user) {
   var foundUser = await client.users.fetch(user.id);
    if(!subscribedUsers["users"].includes(user.id)) {
        subscribedUsers.users.push(user.id);
    }
    fs.writeFileSync(pathToDB, JSON.stringify(subscribedUsers), 'utf-8');
}

if(!fs.existsSync(pathToDB)) {
    initSubscribersDB();
}

function initSubscribersDB() {
    fs.writeFileSync(pathToDB, '{"users":[]}', 'utf-8');
}

readAllSubscribedUsers();

function readAllSubscribedUsers() {
    subscribedUsers = JSON.parse(fs.readFileSync(pathToDB, 'utf-8'));
}

/**
 * sends "Le journal" to a user
 * @param {String} userID 
 */
async function sendJournalTo(userID) {
    console.log("getting journal ready");
    console.log(currenciesValues);
    console.log(cryptoValues);
    let foundUser = await client.users.fetch(userID);
    let userDMChannel = await foundUser.createDM();
    let newsInJournal = [];

    console.log("creating the embed");
    let stringCrypto = "";
    cryptoValues.forEach((crypto) => {
        console.log(crypto);
        stringCrypto += `**${crypto.NAME}** \r **Prix** = ${crypto.PRICE}$ \r ${crypto.PERCENTAGE}% \r Haut = ${crypto.HIGH} \r Bas = ${crypto.LOW}\r\n`
    })
    console.log(stringCrypto);
    var actusEmbed = new MessageEmbed()
    .setColor('#0099ff')
    .setTitle('Bonjour ! Vous avez reçu votre journal matinal ! :newspaper:')
    .setAuthor({ name: 'MonaBot', 'iconURL':'https://cdn.discordapp.com/app-icons/958405000101519372/2f4f565eb1a8418f0b95deb28776723b.png?size=512' })
    .setDescription('Voici les dernières actualités...')
    .addFields(
        { name: `A propos des actualités`, value: `Mona a trouvé ${articles.length} articles provenant de flux RSS de sites d'actus français.\r\nInformations non vérifiées par MonaBot !` },
        //{ name: 'Autre informations', value: 'Si vous souhaitez connaitre la météo envoyez "!météo" suivi de votre numéro de département dans le chat !' },
        { name: `Taux de conversion des monnaies basé sur l'Euro`, value: `1€ = ${currenciesValues.USD}$ **Dollar(s) américain (USD)**\r\n1€ = ${currenciesValues.JPY}¥ **Yen(s) (JPY)**\r\n1€ = ${currenciesValues.GBP}£ **Livre(s) sterlings (GBP)**` },
        { name: `Actualité des cryptomonaies`, value: stringCrypto.toString() }
    )
    .setTimestamp()
    .setFooter({ text: 'MonaBot actus utilise différents flux RSS', iconURL: 'https://cdn.discordapp.com/app-icons/958405000101519372/2f4f565eb1a8418f0b95deb28776723b.png?size=512' });
    console.log(articles.length + " articles found");
    console.log("adding articles...");

    for (let i = 0; i < articles.length; i++) {
        const currentArticle = articles[i];
        if(newsInJournal.includes(currentArticle.title)) {
            console.log("article already in news");
         } else {
             console.log('putting article in');
            newsInJournal.push(currentArticle.title);
            actusEmbed.addFields(
                { name: `${currentArticle.title}\r\n(${currentArticle.author})`, value: 'Lisez l\'article complet sur ' + currentArticle.linkToArticle + "\r\n" +  currentArticle.description}
            )
            
       }
    }
    console.log("sending journal");
    userDMChannel.send({ embeds: [actusEmbed]});
}

async function getRandomFieldsPhoto() {
    return new Promise(async resolve => {
        const response = await fetch('https://source.unsplash.com/800x600?fields');
        resolve(response.url);

    });

}