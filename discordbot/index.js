const { token, departements, weather_api_key } = require('./config.json');
// Require the necessary discord.js classes
const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, Intents, MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu, Emoji, Guild, BaseGuildEmoji } = require('discord.js');
const fetch = require("node-fetch");

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
console.log(client.emojis.resolve("flag_fr"));


// When the client is ready, run this code (only once)
client.once('ready', () => {
	console.log('Ready!');
});

client.on('interactionCreate', async interaction => {

    
	const { commandName, componentType } = interaction;
    if(componentType === 'SELECT_MENU') {
        if(interaction.customId == "select_country") {
            interaction.channel.send("");

        }
    }

	if (commandName === 'mona') {
		await interaction.reply({content:`Je suis là !`});
	} else if (commandName === 'meteo') {
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
    getBiggestCityOnDepartment(zipcode_depart).then(cityInfo => {
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
            WeatherEmbed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle('Mona Météo :satellite:')
                .setAuthor({ name: 'MonaBot', 'iconURL':'https://cdn.discordapp.com/app-icons/958405000101519372/2f4f565eb1a8418f0b95deb28776723b.png?size=512' })
                .setDescription('Laissez-moi vérifier en ' + depart_name + ` (${zipcode_depart}) Ville : ${cityInfo.nom}`)
                .addField(`Température actuelle dans le ${zipcode_depart}`, `:thermometer: ${weather.temp}°C ressenti ${weather.feels_temp} °C\r\n`)
                .addField(`Météo actuelle dans le ${zipcode_depart}`, `Le temps est **${weather.desc}** ${emojiState}`)
                .setTimestamp()
                .setFooter({ text: 'MonaBot météo fonctionne avec openweathermap.org et geo.api.gouv.fr', iconURL: 'https://openweathermap.org/themes/openweathermap/assets/img/mobile_app/android-app-top-banner.png' });
                
                interaction.reply({ embeds: [WeatherEmbed]});
        
            })
    })


  
        
	} else if (commandName === 'user') {
		await interaction.reply('User info.');
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

    console.log("request : " + `https://api.openweathermap.org/data/2.5/weather?zip=${depart_code}000,fr&appid=${weather_api_key}&units=metric&lang=fr`)
    return new Promise(resolve => {
        fetch(`https://api.openweathermap.org/data/2.5/weather?zip=${depart_code},fr&appid=${weather_api_key}&units=metric&lang=fr`)
        .then(res => 
            res.json()
        )
        .then(json => {
            console.log(json)
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

async function getBiggestCityOnDepartment(depart_code) {

    var city = "";
    console.log("request : " + `https://geo.api.gouv.fr/departements/${depart_code}/communes`)
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

