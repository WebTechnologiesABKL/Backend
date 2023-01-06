const http = require("http");
const express = require("express");
const socketIo = require("socket.io");
const geoip = require("geoip-lite");

const SERVER_PORT = 8080;

const users = [];

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
    return dateString;
}

function convertWeatherToString(weather){
    let weatherString = weather.weather.weather[0].icon + ' bei ' + weather.weather.weather[0].temperature + '°C.';

    return weatherString;
}
async function getWeather(time, city, country){
    return new Promise(resolve => {
        http.get('http://localhost:8090/weather?city=' + city + '&country=' + country + '&time=' + time, (resp) => {
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
function onNewWebsocketConnection(socket) {
    console.info(`Socket ${socket.id} has connected.`);
    users.push({
        socketId: socket.id,
        ipAddress: socket.conn.remoteAddress,
        lastMessage: "",
        lastCity: "",
        lastCountry: "DE",
        lastTime: new Date()
    })
    console.log(users);


    socket.on("disconnect", () => {
        console.info(`Socket ${socket.id} has disconnected.`);
        users.forEach((user, i) => {
            if(user.socketId == socket.id){
                users.splice(i, 1);
            }
        });
        console.log(users);
    });

    // echoes on the terminal every "hello" message this socket sends
    socket.on("chat", async function(data){
        console.info(`Socket ${socket.id} has sent information:`);
        console.info(data);

        let geo = geoip.lookup(socket.conn.remoteAddress);
        let time = new Date();
        let country;
        let city;
        if(geo){
            country = geo.country;
            city = geo.city;
        }else{
            country = "DE";
            city = "Bielefeld";
        }


        //interpretiere text mit RASA

        let weather = await getWeather(time, city, country);
        let weatherString = convertWeatherToString(weather);
        socket.emit("chat", {
            message: 'We received your message ("' + data.message + '")\nDas Wetter in ' + city + ', ' + country + ' ist am '+ convertDateToString(time) +
                ' ' + weatherString
        });
        users.forEach((user, i) => {
            if(user.socketId == socket.id){
                users[i].lastMessage = data.message;
            }
        })
    });

    // will send a message only to this socket (different than using `io.emit()`, which would broadcast it)
    socket.emit("welcome", {
        socketId: socket.id
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