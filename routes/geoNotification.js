var express = require('express');
var router = express.Router();
var op = require('../oracleDBOps');
var async = require('async');
var oracledb = require('oracledb');


router.get('/geoFence', function (req, res) {
    geoFence(req, res);
});

router.post('/geoFence', function (req, res) {
    geoFence(req, res);
});

module.exports = router;



function geoFence(req, res) {

    let errArray = [];
    let doneArray = [];
    let sqlStatement;
    let bindArr = [];
    let deviceId = req.query.deviceID;

    let gpsTime = req.query.lastGpsTimeInS;
    let notification = req.query.notification;

    let ts = parseInt(req.query.lastGpsTimeInS) * 1000;

    if (notification === 'Bosch_Exit_Notification')
        notification = 'Exit';
    if (notification === 'Bosch_Entry_Notification')
        notification = 'Entry';

    let location = req.query.location;
    let batterLevel = req.query.batterLevel;
    let comments = `GPS Time:${gpsTime} ,notification:${notification},map location :${location}`;

    if (batterLevel) {
        comments = comments || `,battery:${batterLevel}`;
    }


    let locId = 'NOMAP';

    var doConnect = function (cb) {
        op.doConnectCB(function (err, conn) {
            cb(null, conn);
        });
    };

    var getGeoMap = function (conn, cb) {
        let getGeoSQL = `SELECT * FROM GEOFENCE_T WHERE GEOFENCE_ID = '${location}' AND TYPE ='LOC_ID'`;
        console.log(getGeoSQL);
        let bindVars = [];
        conn.execute(getGeoSQL, bindVars, {
            autoCommit: true, // Override the default non-autocommit behavior
            outFormat: oracledb.OBJECT // Return the result as Object
        }, function (err, result)
        {
            if (err) {
                cb(err, conn);
            } else {
                result.rows.forEach(function (row) {
                    console.log(row);
                    locId = row.MAP_VAL;
                });
                cb(null, conn);
            }
        });
    };

    var getInvoices = function (conn, cb) {
        let getInvSQL = `SELECT * FROM INV_HDR_T WHERE DEVICE_ID = '${deviceId}' AND STATUS ='Dispatched'`;
        sqlStatement = "INSERT INTO EVENTS_T VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15,:16,:17,:18,:19,:20) ";

        let binVars = [deviceId, 'Device', 'Notification', new Date(ts), locId, '', '', '', 0, '', 'Device', comments, 0, ts, null, null, '', '', deviceId, null];
        bindArr.push(binVars);

        let bindVars = [];
        conn.execute(getInvSQL, bindVars, {
            autoCommit: true// Override the default non-autocommit behavior
        }, function (err, result)
        {
            if (err) {
                cb(err, conn);
            } else {
                result.rows.forEach(function (row) {
                    let event = 'Geofence';
                    if (locId===row[3]){
                         event = 'Reached';
                    }
                    let binVars = [row[0], 'Invoice', event, new Date(ts), locId, row[3], '', '', 0, row[0], 'Device', comments, 0, ts, null, null,  row[7], '', deviceId, null];
                    bindArr.push(binVars);
                });
                cb(null, conn);
            }
        });
    };

    function doInsert(conn, cb) {
        console.log("In  doInsert");
        let arrayCount = 1;
        async.eachSeries(bindArr, function (data, callback) {
            arrayCount++;
            console.log("Inserting :", JSON.stringify(data));
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
                console.log("Event Insert Error");
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
                getGeoMap,
                getInvoices,
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