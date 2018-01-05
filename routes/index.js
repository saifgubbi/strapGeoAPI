/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var express = require('express');
var router = express.Router();

router.use('/geoNotificaton', require('./geoNotification'));
router.use('/gps', require('./gps'));

router.get('/', function (req, res) {
    res.send('Welcome to  STRAP GEO Apis!');
});


module.exports = router;