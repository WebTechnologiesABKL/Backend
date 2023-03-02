const http = require("http");
const express = require("express");
const socketIo = require("socket.io");


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
        dateString += "." + (date.getMonth() + 1);
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

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function convertWeatherToString(weather){
    let icon = weather.weather.weather[0].icon;
    switch (icon) {
        case "clear-day":
            icon = "sonnig"
            break;
        case "partly-cloudy-day":
            icon = "teilweise bewölkt"
            break;
        case "partly-cloudy-night":
            icon = "teilweise bewölkt"
            break;
        case "clear-night":
            icon = "bewölkt"
            break;
        case "cloudy":
            icon = "bewölkt"
            break;
        case "sunny":
            icon = "sonnig"
            break;
        case "wind":
            icon = "windig"
            break;
        case "fog":
            icon = "nebelig"
            break;
        case "rain":
            icon = "regnerisch"
            break;
        case "snow":
            icon = "schneeig"
            break;
        case "thunderstorm":
            icon = "gewitterig"
            break;
        case "sleet":
            icon = "schneeregen"
            break;
    }
    let weatherString = icon + ' bei ' + weather.weather.weather[0].temperature + '°C.';



    return weatherString;
}
async function getWeather(time, lat, lon){
    return new Promise(resolve => {
        http.get('http://weather:8090/weather?lat=' + lat + '&lon=' + lon + '&time=' + time, (resp) => {
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
            console.error("Error: " + err.message);
            resolve({
                error: err.message
            })
        });
    });
}

async function getIP(ip){
    return new Promise(resolve => {
        http.get('http://weather:8090/ip?ip=' + ip, (resp) => {
            let data = '';

            // A chunk of data has been received.
            resp.on('data', (chunk) => {
                data += chunk;
            });

            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                let result = JSON.parse(data);
                resolve({
                    city: data.city,
                    country: data.country
                });
            });

        }).on("error", (err) => {
            console.error("Error: " + err.message);
            resolve({
                error: err.message
            })
        });
    });
}

async function getCoordinates(city, country){
    return new Promise(resolve => {
        http.get('http://weather:8090/coordinates?city=' + city + '&country=' + country, (resp) => {
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
            console.error("Error: " + err.message);
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
                console.error("Error: " + err.message);
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
                console.error("Error: " + err.message);
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
    users.push({
        socketId: socket.id,
        ipAddress: socket.conn.remoteAddress.substring(socket.conn.remoteAddress.lastIndexOf(":") + 1),
        lastMessage: "",
        lastCity: "new",
        lastCountry: "DE",
        lastTime: new Date()
    });
    for (const user of users) {
        const i = users.indexOf(user);
       if(user.socketId == socket.id){
           try{
               let ipCity = await getIP(user.ipAddress);
               if(await ipCity.error){
                   console.log("----------------------------------------");
                   console.log("Could not interpret IP Address!");
                   users[i].lastCountry = "DE";
                   users[i].lastCity = "Bielefeld";
                   console.log("----------------------------------------");
               }else{
                   console.log("----------------------------------------");
                   console.log("IP-Data:");
                   console.log(JSON.stringify(await ipCity));
                   if(await ipCity.city){
                       users[i].lastCity = await ipCity.city;
                   }else{
                       users[i].lastCity = "Bielefeld";
                   }
                   if(await ipCity.country){
                       users[i].lastCountry = await ipCity.country;
                   }else{
                       users[i].lastCountry = "DE";
                   }

                   console.log("----------------------------------------");
               }
           }catch(e){
               console.log("----------------------------------------");
               console.log("Could not interpret IP Address!");
               users[i].lastCountry = "DE";
               users[i].lastCity = "Bielefeld";
               console.log("----------------------------------------");
           }
       }
    }
    console.log("----------------------------------------");
    console.log("Users:");
    console.log(users);
    console.log("----------------------------------------");

    // will send a message only to this socket (different than using `io.emit()`, which would broadcast it)
    socket.emit("welcome", {
        message: "Wilkommen beim Wetter Chatbot, fragen Sie mich etwas 🌞"
    });

    socket.on("disconnect", () => {
        console.info(`Socket ${socket.id} has disconnected.`);
        users.forEach((user, i) => {
            if(user.socketId == socket.id){
                users.splice(i, 1);
            }
        });
        console.log("----------------------------------------");
        console.log("Users:");
        console.log(users);
        console.log("----------------------------------------");
    });

    // echoes on the terminal every "hello" message this socket sends
    socket.on("chat", async function(data){
        console.info(`Socket ${socket.id} has sent information:`);
        console.info(data);
        socket.emit("writing", {
           active: true
        });

        try{
            let time = new Date().addHours(1);
            let country = "DE";
            let city = "Bielefeld";
            users.forEach((user, i) => {
                if(user.socketId == socket.id){
                    if(users[i].lastCity !== "new"){
                        city = users[i].lastCity;
                        country = users[i].lastCountry;
                        time = users[i].lastTime;
                    }
                }
            });


            let interpretation = await interpretMessage(data.message);
            console.log("----------------------------------------");
            console.log("interpretation:");
            console.log(JSON.stringify(await interpretation));
            console.log("----------------------------------------");
            if((await interpretation.entities.length > 0 && (await interpretation.entities[0].entity === "LOC" || await interpretation.entities[0].entity === "time")) || await interpretation.intent.name == "weather"){
                await interpretation.entities.forEach(entity => {
                    if(entity.entity === "LOC"){
                        city = entity.value;
                        city = city.replaceAll('?', '');
                        city = capitalizeFirstLetter(city);
                    }else if(entity.entity === "time"){
                        if(entity.value.from){
                            time = new Date(((new Date(entity.value.from)).getTime() + (new Date(entity.value.to)).getTime()) / 2);
                        }else{
                            if(new Date(entity.value).getHours() <= 2){
                                time = (new Date(entity.value)).addHours(6);
                            }else if(new Date(entity.value).getHours() >= 22){
                                time = (new Date(entity.value)).addHours(8);
                            }
                            else{
                                time = (new Date(entity.value))
                            }
                        }
                    }
                });
                let coordinates = await getCoordinates(city, country);
                if(!await coordinates.lon && !await coordinates.lat){
                    throw new Error("Error getting Coordinates from City & Country");
                }
                let weather = await getWeather(time, await coordinates.lat, await coordinates.lon);
                try{
                    let weatherString = convertWeatherToString(weather);
                    let oldTime = time;
                    time = time - (time.getHours() - 1) *  3600000
                    let weather = await getWeather(time, await coordinates.lat, await coordinates.lon);
                    setTimeout(async () => {
                        socket.emit("writing", {
                            active: false
                        });
                        socket.emit("chat", {
                            message: 'Das Wetter in ' + city + ', ' + country + ' ist am '+ convertDateToString(time) +
                                ' ' + weatherString,
                            weather: await weather,
                            time: oldTime,
                            city: city,
                            country: country
                        });
                        socket.emit("writing", {
                            active: true
                        });
                        users.forEach((user, i) => {
                            if(user.socketId == socket.id){
                                users[i].lastMessage = data.message;
                                users[i].lastCity = city;
                                users[i].lastCountry = country;
                                users[i].lastTime = time;
                            }
                        });
                        let finished = new Promise(async (resolve) => {
                            let forecast = [weather];
                            for (let i = 1; i < 7; i++) {
                                time = time.addHours(24);
                                let weatherI = await getWeather(time, await coordinates.lat, await coordinates.lon);
                                if(i === 6 && await weatherI){
                                    forecast.push(await weatherI);
                                    resolve(forecast);
                                }else{
                                    forecast.push(await weatherI);
                                }
                            }
                        });
                        if(await finished){
                            console.log("----------------------------------------");
                            console.log("forecast:");
                            console.log(await finished);
                            console.log("----------------------------------------");
                            setTimeout(async () => {
                                socket.emit("writing", {
                                    active: false
                                });
                                socket.emit("forecast", {
                                    forecast: await finished,
                                    city: city,
                                    country: country
                                });
                            }, 2000);
                        }else{
                            socket.emit("writing", {
                                active: false
                            });
                        }
                    }, 1000);
                }catch(e){
                    socket.emit("chat", {
                        message: 'Ich habe Probleme die Wetterdaten abzurufen, bitte versuche es nocheinmal',
                        weather: null
                    });
                }
            }else{
                let answer = await answerMessage(socket.id, data.message);
                console.log("----------------------------------------");
                console.log("answer:");
                console.log(JSON.stringify(await answer));
                console.log("----------------------------------------");
                socket.emit("writing", {
                    active: false
                });
                if(await answer.length > 0){
                    await answer.forEach(a => {
                        if(a.text){
                            socket.emit("chat", {
                                message: a.text,
                                weather: null
                            });
                        }else if(a.image){
                            socket.emit("image", {
                                image: a.image,
                                weather: null
                            });
                        }
                    })
                }else{
                    socket.emit("chat", {
                        message: "Ich habe Probleme deine Anfrage zu beantworten...",
                        weather: null
                    });
                }

                users.forEach((user, i) => {
                    if(user.socketId == socket.id){
                        users[i].lastMessage = data.message;
                    }
                });
            }
        }catch(e){
            socket.emit("writing", {
                active: false
            });
            socket.emit("chat", {
                message: "Ich habe Probleme deine Anfrage zu beantworten...",
                weather: null
            });
        }


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