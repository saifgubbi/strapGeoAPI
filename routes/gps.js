var express = require('express');
var router = express.Router();
var op = require('../oracleDBOps');
var async = require('async');
var filepath = 'log/GeoDevice.txt';
var fileContent = ' ';
var fs = require('fs');

router.post('/device', function (req, res) {
    postGps(req, res);
});

module.exports = router;

function postGps(req, res) {

    let ts = new Date().getTime();
    let bindArr = [];

    /*Insert Pallet SQL*/
//    {
//	"data": {
//		"altitude": 0,
//		"address": "Chennai(19.51),TN",
//		"lastLat": 13.0030655556,
//		"lastGpsTimeInMs": 1515123094,
//		"lastLang": 80.00744,
//		"speedInKmh": 0,
//		"deviceName": "BOSCH011",
//		"batteryLevel": 3.75
//	},
//	"success": true
//}
    //console.log(req.body);
    let fileContent = JSON.stringify(req.body);//JSON.stringify(req);
     fs.appendFile(filepath, fileContent, (err) => {    
        if (err) throw err;
    console.log("The file was succesfully saved!");
    });
    let sqlStatement = "INSERT INTO GPS_DEVICE_T VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9) ";
    console.log(req.body.success);
   if (req.body.success === true)
   {

        let binVars = [req.body.data.deviceName, ts, req.body.data.lastLat, req.body.data.lastLang, req.body.data.altitude, req.body.data.address, req.body.data.lastGpsTimeInMs, req.body.data.speedInKmh, req.body.data.batteryLevel];
              bindArr.push(binVars);

    console.log(req.body.data.deviceName);
    insertEvents(req, res, sqlStatement, bindArr);
   }
   else
   {
       console.log(req.body);
       console.log('API Failed');
   }
}



function insertEvents(req, res, sqlStatement, bindArr) {

    let errArray = [];
    let doneArray = [];

    var doConnect = function (cb) {
        op.doConnectCB(function (err, conn) {
            cb(null, conn);
        });
    };

    function doInsert(conn, cb) {
       // console.log("In  doInsert");
        let arrayCount = 1;
        async.eachSeries(bindArr, function (data, callback) {
            arrayCount++;
        //    console.log("Inserting :", JSON.stringify(data));
            let insertStatement = sqlStatement;
            let bindVars = data;
            //  console.log(bindVars.join());
            conn.execute(insertStatement
                    , bindVars, {
                        autoCommit: true// Override the default non-autocommit behavior
                    }, function (err, result)
            {
                if (err) {
                    console.log("Error Occured: ", err);
                    errArray.push({row: arrayCount, err: err});
                    callback();
                } else {
                    console.log("Rows inserted: " + result.rowsAffected); // 1
                    doneArray.push({row: arrayCount});
                    callback();
                }
            });
        }, function (err) {
            if (err) {
                console.log("Device Insert Error");
                res.writeHead(500, {'Content-Type': 'application/json'});
                errArray.push({row: 0, err: err});
                res.end(`errorMsg:${err}}`);
            } else {
                res.writeHead(200);
                res.end(`{total : ${bindArr.length},success:${doneArray.length},error:${errArray.length},errorMsg:${errArray}}`);
            }
            cb(null, conn);
        }
        );
    }

    async.waterfall(
            [doConnect,
                doInsert
            ],
            function (err, conn) {
                if (err) {
                    console.error("In waterfall error cb: ==>", err, "<==");
                    res.status(500).json({message: err});
                }
                console.log("Done Waterfall");
                if (conn)
                    conn.close();
            });
}