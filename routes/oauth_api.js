/**
 * @Module   : Wechat oauth Module
 * @Brief    : Process Wechat oauth
 */
var config  = require('./config'),
    _       = require('lodash'),
    ejwt    = require('express-jwt'),
    jwt     = require('jsonwebtoken');

var axios = require('axios');
var mysql = require('mysql');

/* 微信登陆 */
// var AppID = 'wx6f3a777231ad1747';
var AppID = "wx1dc40895f45755ba";
// var AppSecret = '881a3265d13a362a6f159fb782f951f9';
var AppSecret = 'c90dcd79135556af5d1ed69c8433b009';

var pool  = mysql.createPool({
  host     : 'rm-wz9irm56yc8scnyy6.mysql.rds.aliyuncs.com',
  user     : 'root',
  password : '!QAZ2wsx',    
  database : 'knowledge',
  timezone : "08:00",
  multipleStatements: true
});

function query(pool, sql, values, callback){
    pool.getConnection(function(err, connection) {
    console.log(sql);
    //console.log(values);
    // Use the connection
    connection.query(sql, values, function (error, results, fields) {
    // And done with the connection.
        connection.release();

    // Handle error after the release.
        if (error) throw error;
        else callback(results);
    // Don't use the connection here, it has been returned to the pool.
        });
    });
}




function isOpenidIn(openid,callback){
    var sql = "select userid from user_auths where identifier = ?;";
    var values = [openid];
    query(pool, sql, values, callback);
}

function getStuRealname(userid,callback){
    var sql = "select c.student_name from `user_code` u,`code_student` c where u.invitation_code = c.invitation_code and u.userid = ?;";
    var values = [userid];
    query(pool, sql, values, callback);
}

function updateWxUserInfo(userid, openid, access_token, nickname, imgurl, callback){
    var sql1 = "update users set nickname = ?,avatar = ? where id = ?;";
    var sql2 = "update user_auths set credential = ? where identifier = ?;";
    var sql  = sql1+sql2;
    var values = [nickname, imgurl, userid,access_token,openid];
    query(pool, sql, values, callback);
}

function insertWxUser(nickname, imgurl, callback){
    var sql = "insert into users(nickname, avatar, role) values(?, ?, ?)";
    var values = [nickname, imgurl, 2];
    query(pool, sql, values, callback);
}

function insertWxUserAuths(userid, openid, access_token, callback){
    var sql = "insert into user_auths(userid, identity_type, identifier, credential) values(?, ?, ?, ?)";
    var values = [userid, 'weixin', openid , access_token];
    query(pool, sql, values, callback);
}

function checkInvitationCode(code, callback){
    var sql = "select invitation_code from code_student where invitation_code = ? and bind = 0";
    var values = [code];
    query(pool, sql, values, callback);
}

function insertUserCode(userid, code, callback){
    var sql1 = "insert into user_code(userid, invitation_code) values(?, ?);";
    var sql2 = "update code_student set bind = 1 where invitation_code = ?;";
    var sql3 = "select student_name from code_student where invitation_code = ?;";
    var sql  = sql1+sql2+sql3;
    var values = [userid, code, code, code];
    query(pool, sql, values, callback);
}

function createAccessToken(userid,nickname,imgurl,name) {
  return jwt.sign({
    userid: userid,
    nickname: nickname,
    imgurl: imgurl,
    name: name,
    iss: config.issuer,
    aud: config.audience,
    exp: Math.floor(Date.now() / 1000) + (60 * 1),
    scope: 'full_access',
    sub: "lalaland|gonto",
    jti: genJti(), // unique identifier for the token
    alg: 'HS256'
  }, config.secret);
}

function genJti() {
  let jti = '';
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 16; i++) {
      jti += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  
  return jti;
}

module.exports = function(app){

// app.get('/wx_login', function(req,res, next){
//     //console.log("oauth - login")

//     // 第一步：用户同意授权，获取code
//     var router = 'get_wx_access_token';
//     // 这是编码后的地址
//     var return_uri = 'http%3a%2f%2fwww.kmap.xin%2f'+router;  

//     var scope = 'snsapi_userinfo';

//     res.redirect('https://open.weixin.qq.com/connect/oauth2/authorize?appid='+AppID+'&redirect_uri='+return_uri+'&response_type=code&scope='+scope+'&state=STATE#wechat_redirect');

// });


app.get('/klmanager/get_wx_auth', function(req,res, next){
    //console.log("get_wx_access_token")
    //console.log("code_return: "+req.query.code)

    // 第二步：通过code换取网页授权access_token
    var code = req.query.code;
    var redirect_uri = req.query.state;
    var newuser = 1;
    // console.log(code);

    var url1='https://api.weixin.qq.com/sns/oauth2/access_token?appid='+AppID+'&secret='+AppSecret+'&code='+code+'&grant_type=authorization_code';
    
    axios.get(url1).then(function (response) {
        var access_token = response.data.access_token;
        var openid = response.data.openid;
        var url2 = 'https://api.weixin.qq.com/sns/userinfo?access_token='+access_token+'&openid='+openid+'&lang=zh_CN';
        axios.get(url2).then(function (response) {
            console.log(response.data);
            var nickname = response.data.nickname;
            var imgurl = response.data.headimgurl;
            isOpenidIn(openid, function(res_userid){
                console.log('res_userid:'+JSON.stringify(res_userid));
                console.log('res_userid.length:'+res_userid.length);
                if(res_userid.length){
                    updateWxUserInfo(res_userid[0].userid, openid, access_token,nickname,imgurl,function(results){

                        getStuRealname(res_userid[0].userid,function(res_name){
                            var group = {
                                redirect_uri:redirect_uri,
                                token:createAccessToken(res_userid[0].userid,nickname,imgurl,res_name[0].student_name)
                            };
                            console.log('group:'+JSON.stringify(group));
                            res.send(group);
                        });

                    });
                }else{
                    var wx_info = {
                        nickname : nickname,
                        imgurl : imgurl,
                        openid : openid,
                        access_token : access_token,
                    };
                    console.log({
                        newuser:newuser,
                        wx_info:wx_info
                    });
                    res.send({
                        newuser:newuser,
                        wx_info:wx_info
                    });
                }
            });  
        })
        .catch(function (error) {
            console.log('error2' + JSON.stringify(error));
        });
    })
    .catch(function (error) {
        console.log('error1' + JSON.stringify(error));
    });
});

app.post('/klmanager/check_invi_code', function(req,res, next){
    var hascode = 0;
    if (req.body.invitationcode) {
        console.log('req.body.invitationcode:'+req.body.invitationcode);
        checkInvitationCode(req.body.invitationcode,function(code){
            var wx_info = req.body.wx_info;
            console.log('wx_info:'+wx_info);
            console.log('nickname'+wx_info.nickname);
            console.log('code.length:'+code.length);
            if(code.length){//邀请码存在且未被使用
                hascode = 1;
                console.log(wx_info.nickname);
                console.log(wx_info.imgurl);
                insertWxUser(wx_info.nickname,wx_info.imgurl,function(results){
                    console.log('results.insertId:'+JSON.stringify(results.insertId));
                    var insert_userid = results.insertId;
                    insertWxUserAuths(insert_userid,wx_info.openid,wx_info.access_token,function(results){
                        insertUserCode(insert_userid,req.body.invitationcode,function(res_name){
                            res.send({
                                token:createAccessToken(insert_userid,wx_info.nickname,wx_info.imgurl,res_name[0].student_name),
                                hascode: hascode,
                            });
                        });

                    });
                });
            }else{
                res.send({hascode: hascode});
            }
        });
    }
});

}
