const http = require("http");
const express = require("express");
const socketIo = require("socket.io");

const SERVER_PORT = 8080;

const users = [];


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

        let time = new Date();
        let country = "DE";
        let city = "Bielefeld";

        //interpretiere text mit RASA

        let weather = await getWeather(time, city, country);

        socket.emit("chat", {
            message: 'We received your message ("' + data.message + '")\nDas Wetter in ' + city + ', ' + country + ' ist am '+ time.getDay() + ' den ' + time.getDate() + '.' +
                (time.getMonth() + 1) + '.' + time.getFullYear() + ' ' + weather.weather.weather[0].icon + ' bei ' + weather.weather.weather[0].temperature + '°C.'
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