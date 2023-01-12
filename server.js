const http = require("http");
const express = require("express");
const socketIo = require("socket.io");
const ipInfo = require("ip-info-finder");


const SERVER_PORT = 8085;

const users = [];

Date.prototype.addHours = function(h) {
    this.setTime(this.getTime() + (h*60*60*1000));
    return this;
}

function convertDateToString(date){
    let dateString = "";
    switch (date.getDay()) {
        case 0:
            dateString = "Sonntag, den ";
            break;
        case 1:
            dateString = "Montag, den ";
            break;
        case 2:
            dateString = "Dienstag, den ";
            break;
        case 3:
            dateString = "Mittwoch, den ";
            break;
        case 4:
            dateString = "Donnerstag, den ";
            break;
        case 5:
            dateString = "Freitag, den ";
            break;
        case 6:
            dateString = "Samstag, den ";
            break;
    }
    if(date.getDate() < 10){
        dateString += "0" + date.getDate();
    }else{
        dateString += date.getDate();
    }
    if(date.getMonth() < 9){
        dateString += ".0" + (date.getMonth() + 1);
    }else{
        dateString += (date.getMonth() + 1);
    }
    dateString += "." + date.getFullYear();

    if(date.getHours() < 10){
        dateString += " - 0" + date.getHours();
    }else{
        dateString += " - " + date.getHours();
    }

    if(date.getMinutes() < 10){
        dateString += ":0" + date.getMinutes();
    }else{
        dateString += ":" + date.getMinutes();
    }

    return dateString;
}

function convertWeatherToString(weather){
    let icon = weather.weather.weather[0].icon;
    switch (icon) {
        case "cloudy":
            icon = "bewölkt";
            break;
        case "sunny":
            icon = "sonnig";
            break;
        case "rain":
            icon = "regnerisch";
            break;
        case "partly-cloudy-day":
            icon = "teilweise bewölkt";
            break;
    }
    let weatherString = icon + ' bei ' + weather.weather.weather[0].temperature + '°C.';



    return weatherString;
}
async function getWeather(time, city, country){
    return new Promise(resolve => {
        http.get('http://weather:8090/weather?city=' + city + '&country=' + country + '&time=' + time, (resp) => {
            let data = '';

            // A chunk of data has been received.
            resp.on('data', (chunk) => {
                data += chunk;
            });

            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                resolve(JSON.parse(data));
            });

        }).on("error", (err) => {
            console.log("Error: " + err.message);
            resolve({
                error: err.message
            })
        });
    });
}

async function interpretMessage(text){
    return new Promise(resolve => {
        const data = JSON.stringify({
            text: text
        });
        const options = {
            hostname: 'rasa',
            port: 5005,
            path: '/model/parse',
            method: 'POST'
        }

        const req = http
            .request(options, res => {
                let data = ''


                res.on('data', chunk => {
                    data += chunk
                })

                res.on('end', () => {
                    resolve(JSON.parse(data))
                })
            })
            .on('error', err => {
                console.log("Error: " + err.message);
                resolve({
                    error: err.message
                })
            })

        req.write(data)
        req.end()
    });
}


async function answerMessage(userID, text){
    return new Promise(resolve => {
        const data = JSON.stringify({
            user: userID,
            message: text
        });
        const options = {
            hostname: 'rasa',
            port: 5005,
            path: '/webhooks/rest/webhook',
            method: 'POST'
        }

        const req = http
            .request(options, res => {
                let data = ''


                res.on('data', chunk => {
                    data += chunk
                })

                res.on('end', () => {
                    resolve(JSON.parse(data))
                })
            })
            .on('error', err => {
                console.log("Error: " + err.message);
                resolve({
                    error: err.message
                })
            })

        req.write(data)
        req.end()
    });
}

async function onNewWebsocketConnection(socket) {
    console.info(`Socket ${socket.id} has connected.`);
    let userNumber = users.push({
        socketId: socket.id,
        ipAddress: socket.conn.remoteAddress,
        lastMessage: "",
        lastCity: "new",
        lastCountry: "DE",
        lastTime: new Date()
    } - 1);
    try{
        await ipInfo.getIPInfo.location(socket.conn.remoteAddress).then(data => {
            console.log(JSON.stringify(data));
            if(data.location[0].address.country_code){
               users[userNumber].lastCountry = data.location[0].address.country_code;
               users[userNumber].lastCountry = users[userNumber].lastCountry.toUpperCase();
            }else if(data.location[0].address.country){
                users[userNumber].lastCountry = data.location[0].address.country;
            }
            if(data.location[0].address.city){
                users[userNumber].lastCity = data.location[0].address.city;
            }else if(data.location[0].address.town){
                users[userNumber].lastCity = data.location[0].address.town;
            }else if(data.location[0].address.county){
                users[userNumber].lastCity = data.location[0].address.county;
            }
        })
            .catch(err => console.log("Could not interpret IP Address!"));

    }catch(e){
        console.log("Could not interpret IP Address!");
    }
    console.log(users);


    socket.on("disconnect", () => {
        console.info(`Socket ${socket.id} has disconnected.`);
        users.splice(userNumber, 1)
        console.log(users);
    });

    // echoes on the terminal every "hello" message this socket sends
    socket.on("chat", async function(data){
        console.info(`Socket ${socket.id} has sent information:`);
        console.info(data);

        socket.emit("writing", {
           active: true
        });

        try{
            let time = new Date();
            let country = "DE";
            let city = "new";
            if(users[userNumber].lastCity !== "new"){
                city = users[userNumber].lastCity;
                country = users[userNumber].lastCountry;
            }else if(city == "new"){
                city = "Bielefeld";
                country = "DE";
            }

            let interpretation = await interpretMessage(data.message);
            console.log(JSON.stringify(await interpretation));
            if(await interpretation.entities.length > 0 || await interpretation.intent.name == "weather"){
                await interpretation.entities.forEach(entity => {
                    if(entity.entity === "LOC"){
                        city = entity.value;
                    }else if(entity.entity === "time"){
                        if(entity.value.from){
                            time = new Date(((new Date(entity.value.from)).getTime() + (new Date(entity.value.to)).getTime()) / 2);
                        }else{
                            time = (new Date(entity.value)).addHours(12);
                        }
                    }
                });
                let weather = await getWeather(time, city, country);
                socket.emit("writing", {
                    active: false
                });
                try{
                    let weatherString = convertWeatherToString(weather);

                    socket.emit("chat", {
                        message: 'Das Wetter in ' + city + ', ' + country + ' ist am '+ convertDateToString(time) +
                            ' ' + weatherString
                    });
                    users[userNumber].lastMessage = data.message;
                    users[userNumber].lastCity = city;
                    users[userNumber].lastCountry = country;
                }catch(e){
                    socket.emit("chat", {
                        message: 'Ich habe Probleme die Wetterdaten abzurufen, bitte versuche es nocheinmal'
                    });
                }
            }else{
                let answer = await answerMessage(userNumber, data.message);

                console.log(JSON.stringify(await answer));
                socket.emit("writing", {
                    active: false
                });
                if(await answer.length > 0){
                    socket.emit("chat", {
                        message: await answer[0].text
                    });
                }else{
                    socket.emit("chat", {
                        message: "Ich habe Probleme deine Anfrage zu beantworten..."
                    });
                }

                users[userNumber].lastMessage = data.message;

            }
        }catch(e){
            socket.emit("writing", {
                active: false
            });
            socket.emit("chat", {
                message: "Ich habe Probleme deine Anfrage zu beantworten..."
            });
        }


    });

    // will send a message only to this socket (different than using `io.emit()`, which would broadcast it)
    socket.emit("welcome", {
        message: "Wilkommen beim Wetter Chatbot, fragen Sie mich etwas 🌞"
    });
}

function startServer() {
    // create a new express app
    const app = express();
    // create http server and wrap the express app
    const server = http.createServer(app);
    // bind socket.io to that server
    const io = socketIo(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // will fire for every new websocket connection
    io.on("connection", onNewWebsocketConnection);

    // important! must listen from `server`, not `app`, otherwise socket.io won't function correctly
    server.listen(SERVER_PORT, () => console.info(`Listening on port ${SERVER_PORT}`));
}

startServer();