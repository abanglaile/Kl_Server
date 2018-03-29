var config  = require('./config'),
    _       = require('lodash'),
    ejwt    = require('express-jwt'),
    jwt     = require('jsonwebtoken');

var mysql = require('mysql');
var pool  = mysql.createPool({
  host     : 'rm-wz9irm56yc8scnyy6.mysql.rds.aliyuncs.com',
  // host     : 'rm-bp19507w6hl2w3rg9so.mysql.rds.aliyuncs.com',
  // host     : 'rm-bp19507w6hl2w3rg9.mysql.rds.aliyuncs.com',
  user     : 'root',
  password : '!QAZ2wsx',    
  database : 'knowledge',
  timezone : "08:00",
  multipleStatements: true
});


function query(pool, sql, values, callback){
    pool.getConnection(function(err, connection) {
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

function compare(property){//用于排序--降序
    return (a,b)=>(b[property]-a[property]);
}

function compareRise(property){//用于排序--升序
    return (a,b)=>(a[property]-b[property]);
}

function getBookChapter(course_id, callback){
    var sql = "select b.bookname, ch.bookid, ch.chapterid, ch.chaptername from chapter ch, book b where b.course_id = ? and ch.bookid = b.bookid order by chapterid asc";
    var values = [];
    values.push(course_id);

    query(pool, sql, values, callback);
}

function getChapterKp(chapter_id, callback){
    var sql = "select * from kptable where chapterid = ?";
    var values = [];
    values.push(chapter_id);
    
    query(pool, sql, values, callback);
}

function getAllChapterKp(callback){
    var sql = "select k.kpid, k.kpname, k.chapterid, c.chaptername from kptable k, chapter c where k.chapterid = c.chapterid";
    var values = [];
    
    query(pool, sql, values, callback);
}

function modifyKp(form, callback){
    var sql = "update kptable set ";
    var values = [];
    for(var key in form){
        if(key == 'kpid' || key == 'key')
            continue;
        sql += key + '= ?, ';
        values.push(form[key]);
    }
    values.push(form.kpid);
    sql = sql.substr(0, sql.length - 2) + " where kpid = ?";
    console.log(sql + ' ' + values);
    
    query(pool, sql, values, callback);
}

function addKp(chapterid, form, callback){
    console.log(chapterid);
    // if(typeof form.kpindex === "string"){
    //     form.kpindex = parseInt(form.kpindex);
    // }
    var sql = 'CALL InsertKp(?, ?, ?, ?, @kpid)';
    var values = [];
    values.push(chapterid);
    values.push(form.kpindex);
    values.push(form.kpname);
    values.push(form.description);

    query(pool, sql, values, callback);
}

function deleteKp(kpid, callback){

    var sql = 'CALL DeleteKp(?)';
    query(pool, sql, [kpid], callback);
}

function getExerciseByKp(kpid, callback){
    var sql = "select e.* , b.*, t.kpname from kp_exercise k, exercise e, breakdown b, kptable t where k.kpid = ? and e.exercise_id = k.exercise_id and b.exercise_id = e.exercise_id and b.kpid = t.kpid";    
    query(pool, sql, [kpid], callback);
}

//添加测试 test
function addNewTest(name,id,size,callback){
    var sql = "insert into teacher_test set test_name=?,teacher_id=?,group_time=(SELECT now()),test_type=1,total_exercise=?;";
    query(pool, sql,[name,id,size],callback);
}

//更新试题的teststate(是否已分发)
function changeTestState(id,callback){
    var sql = "update teacher_test t set t.`enable_time` = (SELECT now()) where test_id = ?;SELECT t.`enable_time` from teacher_test t where test_id = ?; ";
    query(pool, sql, [id,id], callback);
}

//添加班级 group
function addNewGroup(name,id,callback){
    var sql = "insert into teacher_group set ?;";
    var params = {teacher_id: id, group_name:name};
    console.log(params);
    query(pool, sql, params, callback);
}

//删除班级分组
function deleteOneGroup(id,callback){
    var sql = "delete from teacher_group where stu_group_id = ?;delete from group_student where stu_group_id = ?;";
    query(pool, sql, [id,id], callback);
}

//删除班级分组中单个学生信息
function deleteOneStudent(id,callback){
    var sql = "delete from group_student where student_id = ?;";
    query(pool, sql, id, callback);
}

//新增班级分组中单个学生信息
function addOneStudent(id,name,phone,groupid,callback){
    var sql = "insert into group_student set ?;";
    var params = {student_name: name, student_id:id, phone_num: phone,stu_group_id:groupid};
    console.log(params);
    query(pool, sql, params, callback);
}

//获得test中的题目数量
function getTestLength(id,callback){
    var sql = "select count(*) as size from `exercise_test` where test_id = ?;";
    query(pool, sql, [id], callback);
}

//新增学生与试题的关系，将试题挂载在学生名下
function addStudentTest(id,keys,testsize,callback){
    var sql = "";
    var params = [];
    console.log("student keys:" + keys);
    for(var i = 0; i < keys.length; i++){
        sql = sql + "insert into test_log set ?;"
        params.push({student_id: keys[i], test_id: id,start_time:null,finish_time:null,test_state:null,correct_exercise:null,total_exercise:testsize});   
    }
    query(pool, sql, params, callback);
}

//删除一条测试记录
function deleteOneTest(testid,callback){
    var sql = "delete from teacher_test where test_id = ?;delete from exercise_test where test_id = ?;";
    query(pool, sql, [testid,testid], callback);
}


//添加测试 test
function addExerciseTest(testid,exercises, callback){
    var sql = "";
    var params = [];
    for(var i = 0; i < exercises.length; i++){
        sql = sql + "insert into exercise_test set ?;"
        params.push({test_id: testid, exercise_id: exercises[i], exercise_index: i});   
    }
    query(pool, sql, params, callback);
}

//更新题目信息
function updateExercise(exercise, callback){
    var sql = "update exercise set ?;";
    var params = {exercise_id: exercise.exercise_id, title: exercise.title, answer: JSON.stringify(exercise.answer), type: exercise.type};
    console.log(params);
    query(pool, sql, params, callback);
}

//更新答案知识点分解
function updateBreakdown(exercise_id, breakdown, callback){
    //TODO: 存在同步问题
    var sql = "delete from breakdown where exercise_id = ?;";
    var params = [exercise_id];
    for(var i = 0; i < breakdown.length; i++){
        sql = sql + "insert into breakdown set ?;"
        params.push({exercise_id: exercise_id, sn: breakdown[i].sn, content: breakdown[i].content, presn: breakdown[i].presn, kpid: breakdown[i].kpid})
    }
    query(pool, sql, params, callback);
}

//根据exercise_id获取题目
function getExerciseByExid(exercise_id, callback){
    var sql = "select e.* , b.*, t.kpname from exercise e, breakdown b, kptable t where e.exercise_id = ? and b.exercise_id = e.exercise_id and b.kpid = t.kpid";
    query(pool, sql, [exercise_id], callback);
}

function getKpExercise(exercise_id, callback){
    var sql = "select kpid from kp_exercise k where exercise_id = ?";
    query(pool, sql, [exercise_id], callback);
}

//根据teacher id 获取学生群组
function getStuGroup(teacher_id, callback){
    var sql = "select t.stu_group_id, t.group_name, g.student_id,g.student_name from teacher_group t, group_student g where t.teacher_id = ? and t.stu_group_id = g.stu_group_id";
    query(pool, sql, teacher_id, callback);
}

//根据test id 获取各学生测试情况
function getTestResultByTeacher(test_id, callback){
    var sql = "select s.student_id,s.finish_time,timestampdiff(MINUTE,s.start_time,s.finish_time) as time_consuming,s.test_state,g.student_name from test_log s, group_student g where s.test_id = ? and s.student_id = g.student_id";
    query(pool, sql, test_id, callback);
}

//根据teacher id 获取老师建立的测试情况
function getTestTable(teacher_id, callback){
    var sql = "select t.test_id,t.test_name,t.enable_time from teacher_test t where t.teacher_id = ?";
    query(pool, sql, teacher_id, callback);
}

//根据teacher name 获取老师下带的班级分组信息
function getClassGroup(name, callback){
    var sql = "select t.stu_group_id,t.group_name from teacher_group t,`user` u where u.user_id = t.teacher_id and u.username = ?";
    query(pool, sql, name, callback);
}

//根据班级 id 学生信息
function getGroupData(stu_group_id, callback){
    var sql = "select g.student_id,g.student_name,g.phone_num from group_student g where g.stu_group_id = ?";
    query(pool, sql, stu_group_id, callback);
}

//根据test_id获取各知识点掌握情况
function getTestKpResult(test_id, callback){
    var sql = "select b.kpid, k.kpname,l.student_id,g.student_name,l.sn_state from breakdown b, breakdown_log l ,kptable k,group_student g where l.test_id = ? and l.exercise_id = b.exercise_id and l.sn = b.sn and l.student_id = g.student_id and b.kpid = k.kpid and l.sn_state >= 0";
    query(pool, sql, test_id, callback);
}

//根据test_id 获取试题详情
function getTestDetail(test_id, callback){
    var sql1 = "select e.*,b.*,k.kpname from exercise e, breakdown b ,kptable k ,exercise_test t where t.test_id = ? and t.exercise_id = e.exercise_id and e.exercise_id = b.exercise_id and b.kpid = k.kpid";
    var sql2 = "select l.exercise_state,l.student_id,l.exercise_id,g.student_name from exercise_log l, group_student g where l.test_id = ? and g.student_id = l.student_id";
    var sql3 = "select g.sn,g.exercise_id,g.sn_state from breakdown_log g where g.test_id = ? and g.sn_state >=0";
    var sql = sql1+';'+sql2+';'+sql3+';';
    query(pool, sql, [test_id,test_id,test_id], callback);
}

//根据student_id 获取学生姓名以及所在班级名称
function getStuInfoById(student_id, callback){
    var sql = "select g.student_name,t.group_name from group_student g,teacher_group t where t.stu_group_id=g.stu_group_id and g.student_id = ?";
    query(pool, sql, student_id, callback);
}

//根据test_id 获取测试名称和测试状态
function getTestInfoById(test_id, callback){
    var sql = "select t.enable_time,t.test_name from teacher_test t where test_id = ?";
    query(pool, sql, test_id, callback);
}


//根据student_id 获取综合概况能力数据(全部题目情况)
function getAlltestProfile(student_id, callback){
    var sql1 = "select count(*) as c from exercise_log l where l.student_id = ?";
    var sql2 = "select count(*) as c from exercise_log l where l.student_id = ? and l.exercise_state = 1";
    var sql3 = "select t.student_rating from student_rating t where t.student_id = ? ORDER BY update_time DESC LIMIT 1";
    var sql = sql1+';'+sql2+';'+sql3+';';
    query(pool, sql, [student_id,student_id,student_id], callback);
}

//根据student_id 获取综合概况能力数据(近20题情况)
function get20testProfile(student_id, callback){
    var sql1 = "SELECT count(*) as c FROM (SELECT l.exercise_state from exercise_log l where l.student_id = ? ORDER BY submit_time DESC  LIMIT 20) s WHERE s.exercise_state = 1";
    var sql2 = "SELECT count(*) as c FROM (SELECT l.exercise_state from exercise_log l where l.student_id = ? ORDER BY submit_time DESC  LIMIT 20) s ";
    var sql3 = "SELECT SUM(s.delta_student_rating) as sum from (SELECT l.delta_student_rating from exercise_log l WHERE l.student_id = ? ORDER BY submit_time DESC LIMIT 20) s";
    var sql = sql1+';'+sql2+';'+sql3+';';
    query(pool, sql, [student_id,student_id,student_id], callback);
}

//根据student_id 获取综合概况能力数据(近50题情况)
function get50testProfile(student_id, callback){
    var sql1 = "SELECT count(*) as c FROM (SELECT l.exercise_state from exercise_log l where l.student_id = ? ORDER BY submit_time DESC  LIMIT 50) s WHERE s.exercise_state = 1";
    var sql2 = "SELECT count(*) as c FROM (SELECT l.exercise_state from exercise_log l where l.student_id = ? ORDER BY submit_time DESC  LIMIT 50) s ";
    var sql3 = "SELECT SUM(s.delta_student_rating) as sum from (SELECT l.delta_student_rating from exercise_log l WHERE l.student_id = ? ORDER BY submit_time DESC LIMIT 50) s";
    var sql = sql1+';'+sql2+';'+sql3+';';
    query(pool, sql, [student_id,student_id,student_id], callback);
}

//根据student_id 获取天梯分数近期变化情况
function getLadderChange(student_id, callback){
    var sql = "SELECT s.student_rating from student_rating s where s.student_id = ? ORDER BY update_time DESC LIMIT 100";
    query(pool, sql, [student_id], callback);
}

//根据student_id 获取所有时间节点天梯分变化情况
function getLadderChangeWithTime(student_id, callback){
    // var sql = "SELECT s.`update_time` ,s.student_rating from student_rating s where s.student_id = ? ORDER BY update_time ASC;";
    var sql = "SELECT a.`update_time` ,a.student_rating from (SELECT s.* from student_rating s "
            +"where s.`student_id` = ? ) a where not EXISTS (select 1 from (SELECT s.* from "
            +"student_rating s where s.`student_id` = ?) b where datediff(a.update_time,b.update_time)=0 and b.id>a.id);";
    query(pool, sql, [student_id,student_id], callback);
}

//根据学生id,kpid  获取kpid各时间节点天梯分变化情况
function getKpLadderChange(student_id,kpid, callback){
    var sql = "select a.update_time ,a.kp_rating from (SELECT s.* from student_kp_history s "
            +"where s.student_id = ? and s.kpid=?) a where not EXISTS "
            +"(select 1 from (SELECT s.*  from student_kp_history s where s.student_id = ? "
            +"and s.kpid=?) b where datediff(a.update_time,b.update_time)=0 and b.logid>a.logid)";
    query(pool, sql, [student_id,kpid,student_id,kpid], callback);
}

//根据student_id 获取最近训练的知识点 (7个)
function getStuRecentKp(student_id, callback){
    var sql = "SELECT s.kpid, s.kp_rating,k.kpname from student_kp s, kptable k where s.kpid=k.kpid and s.student_id = ? ORDER BY update_time DESC LIMIT 7";
    query(pool, sql, [student_id], callback);
}

//根据student_id 获取掌握最好最差的知识点（各3个）
function getStuExtremeKp(student_id, callback){
    var sql1 = "SELECT s.kpid, s.kp_rating,k.kpname from `student_kp` s, `kptable` k where s.kpid=k.kpid and s.`student_id` = ? ORDER BY `kp_rating` DESC  LIMIT 3";
    var sql2 = "SELECT s.kpid, s.kp_rating,k.kpname from `student_kp` s, `kptable` k where s.kpid=k.kpid and s.`student_id` = ? ORDER BY `kp_rating` ASC  LIMIT 3"; 
    var sql = sql1+';'+sql2+';';
    query(pool, sql, [student_id,student_id], callback);
}
//根据student_id 获取最常训练到的知识点（3个）
function getStuComUsedKp(student_id, callback){
    // var sql = "SELECT t.c,t.kpid,k.kpname from (SELECT count(s.kpid) as c,s.kpid from `student_kp_rating` s where s.`student_id` =?  GROUP BY kpid) t,`kptable` k where k.kpid=t.kpid ORDER BY t.c DESC  LIMIT 7";
    // var sql = "SELECT temp.c,temp.kpid,temp.kpname,temp.student_id,l.exercise_state from (SELECT t.c,t.kpid,k.kpname,t.student_id from (SELECT count(s.kpid) as c,s.kpid,s.`student_id` from `student_kp_rating` s where s.`student_id` =?  GROUP BY kpid) t,`kptable` k where k.kpid=t.kpid ORDER BY t.c DESC  LIMIT 7) as temp,`kptable` k,`kp_exercise` e,`exercise_log` l where k.kpid=temp.kpid and k.kpid = e.kpid and e.exercise_id = l.exercise_id and temp.student_id = l.student_id";
    var sql = "SELECT r.c,r.kpid,r.kpname,sum(r.exercise_state) as cc from (SELECT temp.c,temp.kpid,temp.kpname,temp.student_id,l.exercise_state from (SELECT t.c,t.kpid,k.kpname,t.student_id from (SELECT count(s.kpid) as c,s.kpid,s.`student_id` from `student_kp_history` s where s.`student_id` =?  GROUP BY kpid) t,`kptable` k where k.kpid=t.kpid ORDER BY t.c DESC  LIMIT 3) as temp,`kptable` k,`kp_exercise` e,`exercise_log` l where k.kpid=temp.kpid and k.kpid = e.kpid and e.exercise_id = l.exercise_id and temp.student_id = l.student_id) as r GROUP BY kpid";
    query(pool, sql, [student_id], callback);
}

//根据chapterid 获取知识点（包含知识点天梯分和最新更新时间）
function getKpWithScore(chapter_id,student_id,callback){
    var sql = "SELECT t.kpid,t.kpname,ss.kp_rating,ss.update_time from (SELECT k.kpid,k.kpname FROM `kptable` k WHERE k.`chapterid` = ?) as t LEFT JOIN  (SELECT s.kpid,s.`kp_rating` ,s.`update_time` from `student_kp` s WHERE s.`student_id` = ?) as ss on t.kpid = ss.kpid";
    query(pool, sql, [chapter_id,student_id], callback);
}


//*************************登录,注册相关API*******************************//
//用户名密码查询
function getUser(userName,password,callback){
    var sql = "select a.username,a.password,a.user_id from user a where a.username = ? and a.password = ?";
    query(pool,sql,[userName,password],callback);
}

// function getUserInfo(userid,callback){
//     var sql = "select t.group_name,g.student_name from `group_student` g,`teacher_group` t where t.stu_group_id = g.stu_group_id and g.student_id = ?";
//     query(pool,sql,[userid],callback);
// }

function getUserName(userName,callback){
    var sql = "select a.username from user a where a.username = ?";
    query(pool,sql,[userName],callback);
}

function createIdToken(user) {
    console.log(_.omit(user, 'password'));
    return jwt.sign(_.omit(user, 'password'), config.secret, { expiresIn: 60*60 });
}

function createAccessToken(username,userid) {
  return jwt.sign({
    username: username,
    userid: userid,
    iss: config.issuer,
    aud: config.audience,
    exp: Math.floor(Date.now() / 1000) + (60 * 1),
    scope: 'full_access',
    sub: "lalaland|gonto",
    jti: genJti(), // unique identifier for the token
    alg: 'HS256'
  }, config.secret);
}

//用户名密码注册

function setNewUser(username,password,callback){
    var sql = "insert into user set ?;";
    var params = {username: username, password:password};
    console.log(params);
    query(pool, sql, params, callback);
}

// Generate Unique Identifier for the access token
function genJti() {
  let jti = '';
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 16; i++) {
      jti += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  
  return jti;
}

// Validate access_token
var jwtCheck = ejwt({
  secret: config.secret,
  audience: config.audience,
  issuer: config.issuer
});


//用户token验证
//*************************登录相关API end *******************************//


module.exports = function(app){
//处理GET请求

// app.get('/klmanager/*', (req, res) => {
//     let token = req.headers['authorization'];
//     if (!token) {
//         res.sendStatus(401);
//     } else {
//         try {                      
//             let decoded = jwt.verify(token, config.secret);
//             console.log(decoded);
//             // res.status(200)
//             //     .json({data: 'Valid JWT found!'});
//             next();
//         } catch (e) {
//             res.sendStatus(401);
//         }
//     }
// })

//app.all('/klmanager/*',jwtCheck);

//http://127.0.0.1:3000/hello/?name=wujintao&email=cino.wu@gmail.com 
app.get('/klmanager/getChapterKp', function(req, res){  
    console.log(req.query.chapter_id);
    getChapterKp(req.query.chapter_id, function(results){
        res.send(results);
    });
    
});

//根据chapterid 获取知识点（包含知识点天梯分和最新更新时间）
app.get('/klmanager/getKpWithScore', function(req, res){  
    console.log(req.query.chapter_id);
    getKpWithScore(req.query.chapter_id,req.query.student_id,function(results){
        console.log(results);
        res.send(results);
    });
    
});

app.get('/klmanager/getBookChapter', function(req, res){
    getBookChapter(req.query.course_id, function(results){
        console.log(results);
        var rep = [];
        for(var i = 0; i < results.length; i++){
            var chapter = results[i];
            var m = true;
            console.log(rep);
            for(var j = 0; j < rep.length; j++){
                var book = rep[j];
                if(book.bookid == chapter.bookid){
                    book.chapters.push({chapterid: chapter.chapterid, chaptername: chapter.chaptername});
                    m = false;
                    break;
                }
            }
            //插入新的bookid
            if(m){
                var book = {bookid: chapter.bookid, bookname: chapter.bookname, chapters: [{
                    chapterid: chapter.chapterid, 
                    chaptername: chapter.chaptername
                }]};
                rep.push(book);
            }
        }
        
        res.send(rep);
    });        
});

app.get('/klmanager/getExerciseByKp', function(req, res) {
    if (req.query.kpid) {
        console.log(req.query.kpid);
        getExerciseByKp(req.query.kpid, function(results){
            var exercise_list = [];
            var exercise_index = [];
            var list_index = 0;
            for(var i = 0; i < results.length; i++){
                var e = results[i];
                const index = exercise_index[e.exercise_id];
                console.log(i + " " + index);
                if(index >= 0){
                    console.log(index);
                    exercise_list[index].breakdown.push({
                        sn: e.sn, 
                        content: e.content, 
                        presn: e.presn, 
                        kpid: e.kpid,
                        kpname: e.kpname,
                    });
                }else{
                    var breakdown = [];
                    breakdown.push({
                        sn: e.sn, 
                        content: e.content, 
                        presn: e.presn, 
                        kpid: e.kpid,
                        kpname: e.kpname,
                    });
                    var exercise = {
                        exercise_id: e.exercise_id, 
                        type: e.exercise_type, 
                        title: e.title, 
                        answer: e.answer,
                        title_img_url: e.title_img_url,
                        title_audio_url: e.title_audio_url,
                        breakdown: breakdown
                    };
                    exercise_list[list_index] = exercise;
                    exercise_index[e.exercise_id] = list_index;
                    list_index++;
                }
            }
            console.log("exercise_list:"+JSON.stringify(exercise_list));
            res.send(exercise_list);
        });        
    }
});

//根据teacher id获取教师中心的测试信息
app.get('/klmanager/getTestTable', function(req, res) {
    console.log(req.query.teacher_id);
    getTestTable(req.query.teacher_id, function(results){
        var test_data = [];
        for(var i = 0; i < results.length; i++){
            var e = results[i];
            test_data.push({
                key:e.test_id,
                testname:e.test_name,
                teststate: e.enable_time ? 1 : 0,
                time : e.enable_time,
            });
        }
        res.send(test_data);
    });
});

//根据教师名字userName 获取教师下带的班级分组信息
app.get('/klmanager/getClassGroup', function(req, res) {
    console.log(req.query.userName);
    getClassGroup(req.query.userName, function(results){
        res.send(results);
    });
});

//根据班级 id获取班级里学生信息
app.get('/klmanager/getGroupData', function(req, res) {
    console.log(req.query.stu_group_id);
    getGroupData(req.query.stu_group_id, function(results){
        res.send(results);
    });
});


app.get('/klmanager/getStudentGroup', function(req, res) {
    console.log(req.query.teacher_id);
    getStuGroup(req.query.teacher_id, function(results){
        console.log(results);
        var student_data = [];
        var student_index = [];
        var list_index = 0;
        for(var i = 0; i < results.length; i++){
            var e = results[i];
            const index = student_index[e.stu_group_id];
            console.log(i + " " + index);
            if(index >= 0){
                console.log(index);
                student_data[index].children.push({
                    label: e.student_name, 
                    value: e.student_id, 
                    key: e.student_id,
                });
            }else{
                var children = [];
                children.push({
                    label: e.student_name, 
                    value: e.student_id, 
                    key: e.student_id, 
                });
                var group = {
                    label: e.group_name, 
                    value: e.stu_group_id, 
                    key: e.stu_group_id, 
                    children: children,
                };
                student_data[list_index] = group;
                student_index[e.stu_group_id] = list_index;
                list_index++;
            }
        }
        res.send(student_data);
    }); 
});

app.get('/klmanager/getTestResultByTeacher', function(req, res) {
    console.log(req.query.test_id);
    getTestResultByTeacher(req.query.test_id, function(results){
        console.log(results);
        var test_data = [];
        var completion_num = 0;//提交完成数
        var score_sum = 0;
        var time_sum = 0;
        var testRes = {
                test_data : test_data,
                completion_per : 0,
                correct_rate : 0,
                timeconsuming_per : 0,
            };
        for(var i = 0; i < results.length; i++){
            if(results[i].finish_time){
                completion_num++;
                score_sum = score_sum+results[i].test_state;
                time_sum = time_sum+results[i].time_consuming;
            }
            test_data.push({
                student_id:results[i].student_id,
                studentname:results[i].student_name,
                completion: results[i].finish_time? true : false,
                score:results[i].test_state,
                end_time:results[i].finish_time,
                time_consuming: results[i].time_consuming,
            });
        }
        testRes.completion_per = Math.round((completion_num/results.length)*100)? Math.round((completion_num/results.length)*100):0;
        testRes.correct_rate = Math.round(score_sum/completion_num)? Math.round(score_sum/completion_num):0;
        testRes.timeconsuming_per = Math.round(time_sum/completion_num);
        console.log('testRes:'+JSON.stringify(testRes));
        res.send(testRes);
    }); 
});

//根据student_id 获取学生姓名以及所在班级
app.get('/klmanager/getStuInfoById', function(req, res) {
    console.log('student_id:'+req.query.student_id);
    getStuInfoById(req.query.student_id, function(results){
        console.log('results+username:'+results);
        res.send(results);
    }); 
});

//根据test_id 获取测试名称和测试状态
app.get('/klmanager/getTestInfoById', function(req, res) {
    console.log('test_id:'+req.query.test_id);
    getTestInfoById(req.query.test_id, function(results){
        console.log('results:'+results);
        var test_info = [];
        test_info.push({
            testname: results[0].test_name,
            teststate: results[0].enable_time ? 1 : 0,
        });
        res.send(test_info);
    }); 
});


//根据学生id 获取学生综合能力（总正确率、近20/50题情况）
app.get('/klmanager/getStuAbility', function(req, res) {
    console.log(req.query.student_id);
    var capatity = [];
    getAlltestProfile(req.query.student_id, function(results){
        console.log(results);
        console.log('results[0]:'+results[0][0]);
        console.log('results[0][0].c:'+results[0][0].c);
        console.log('results[2][0].student_rating:'+results[2][0].student_rating);
        var group1 = {
            key : '1',
            exercount : results[0][0].c,   //做过的题目总数
            rate : ((results[1][0].c/results[0][0].c)*100).toFixed(1),  //总正确率
            ladderscore : results[2][0].student_rating,  //最新的天梯分
        };
        capatity.push(group1);
        get20testProfile(req.query.student_id, function(results){
            console.log(results);
            var group2 = {
                key : '2',  
                exercount : results[1][0].c,   
                rate : ((results[0][0].c/results[1][0].c)*100).toFixed(1),  //最近20题正确率
                ladderscore : results[2][0].sum,  //最近20题变化的天梯分
            };
            capatity.push(group2);
            get50testProfile(req.query.student_id, function(results){
                console.log(results);
                var group3 = {
                    key : '3',
                    exercount : results[1][0].c,   
                    rate : ((results[0][0].c/results[1][0].c)*100).toFixed(1),  //最近50题正确率
                    ladderscore : results[2][0].sum,  //最近50题变化的天梯分
                };
                capatity.push(group3);
                console.log('capatity:'+JSON.stringify(capatity));
                res.send(capatity);
            });
        });
    });
});

//根据学生id  获取所有时间节点天梯分变化情况
app.get('/klmanager/getStuLadderWithTime', function(req, res) {
    console.log(req.query.student_id);

    getLadderChangeWithTime(req.query.student_id, function(results){
        console.log('results:'+JSON.stringify(results));
        res.send(results);
    });
});

// //根据学生id,kpid 获取学生知识点能力综合概况（天梯分，正确率，练习次数）
// app.get('/klmanager/getStuKpAbility', function(req, res) {
//     console.log(req.query.student_id);
//     console.log("kpid:"+req.query.kpid);
//     getKpAbility(req.query.student_id,req.query.kpid,function(results){
//         console.log('results:'+JSON.stringify(results));
//         res.send(results);
//     });
// });

//根据学生id,kpid  获取kpid各时间节点天梯分变化情况
app.get('/klmanager/getStuKpLadder', function(req, res) {
    console.log("student_id:"+req.query.student_id);
    console.log("kpid:"+req.query.kpid);
    getKpLadderChange(req.query.student_id,req.query.kpid,function(results){
        console.log('results:'+JSON.stringify(results));
        res.send(results);
    });
});

//根据学生id  获取近100题的天梯积分
app.get('/klmanager/getStuLadder', function(req, res) {
    console.log(req.query.student_id);
    var ladder = [];

    getLadderChange(req.query.student_id, function(results){
        console.log(results);
        for(var i = 0; i < results.length; i++){
            ladder.push({
                procount : i+1,
                score : results[results.length-1-i].student_rating,
            });
        }
        console.log('ladder:'+JSON.stringify(ladder));
        res.send(ladder);
    });
});

//根据学生id  获取最近训练的知识点 (7个)
app.get('/klmanager/getStuRecentKp', function(req, res) {
    console.log(req.query.student_id);
    getStuRecentKp(req.query.student_id, function(results){
        console.log(results);
        res.send(results);
    });
});

//根据学生id  获取掌握最好最差的知识点（各3个）
app.get('/klmanager/getStuExtremeKp', function(req, res) {
    console.log(req.query.student_id);
    getStuExtremeKp(req.query.student_id, function(results){
        console.log(results);
        res.send(results);
    });
});

//根据学生id  获取最常训练到的知识点（3个）
app.get('/klmanager/getStuComUsedKp', function(req, res) {
    console.log(req.query.student_id);
    var usedkp = [];
    getStuComUsedKp(req.query.student_id, function(results){
        console.log('results+usedkp:'+JSON.stringify(results));
        for(var i = 0; i < results.length; i++){
            usedkp.push({
                kpid : results[i].kpid,
                kpname : results[i].kpname,
                usedcount : results[i].c,
                rate : ((results[i].cc/results[i].c)*100).toFixed(1),
            });
        }
        console.log('usedkp:'+JSON.stringify(usedkp));
        res.send(usedkp);
    });
});

app.get('/klmanager/getTestKpResult', function(req, res){
    console.log(req.query.test_id);
    getTestKpResult(req.query.test_id, function(results){
        console.log(results);
        var kp_data = [];
        var kp_index = [];
        var kp_stu = [];
        for(var i = 0; i < results.length; i++){
            var e = results[i];
            const index_kp = kp_index[e.kpid.toString()]; //kpid 知识点的索引
            const index_stu = kp_stu[e.kpid+'-'+e.student_id]; //知识点id以及学生id共同确定错误次数的索引
            if(index_kp >= 0){
                kp_data[index_kp].kp_count_all++;//此知识点测试次数加1
                if(index_stu >=0){//能唯一确定元素时
                    if(e.sn_state === 0){//当state 错误时,count 加1
                        kp_data[index_kp].stu_mistake[index_stu].stu_count++; 
                    }else{
                        kp_data[index_kp].kp_count++;//当state 正确时,kp_count 加1
                    }
                }
                else{//知识点id确定，stu id为新id时，需新增元素
                    if(e.sn_state === 1){
                        kp_data[index_kp].kp_count++; //正确次数加1
                    }
                    var newstu = {
                        student_id: e.student_id, 
                        student_name: e.student_name, 
                        stu_count: e.sn_state>0 ? 0 : 1,
                        stu_rate:0,
                    }
                    kp_data[index_kp].stu_mistake.push(newstu);                
                    kp_stu[e.kpid+'-'+e.student_id] = kp_data[index_kp].stu_mistake.length - 1; //hashmap 记录下新增元素在 stu_mistake 里的位置
                }
            }else{//kpid 为新增id时
                var stu_mistake = [{
                    student_id: e.student_id, 
                    student_name: e.student_name, 
                    stu_count : e.sn_state>0 ? 0 : 1,
                    stu_rate:0,
                }];
                var group = {
                    kpid: e.kpid, 
                    kpname: e.kpname, 
                    kp_count : e.sn_state>0 ? 1 : 0, //此知识点的正确次数（在单次测验中）
                    kp_count_all : 1,
                    kp_correct_rate: 0, //此知识点的正确率
                    stu_mistake: stu_mistake,
                };
                kp_data.push(group);
                kp_index[e.kpid.toString()] = kp_data.length - 1;
                kp_stu[e.kpid+'-'+e.student_id] = 0; //hashmap 记录下新增元素在 stu_mistake 里的位置
            }
        }
        // kp_data = kp_data.sort(compare('kp_count'));//将数组按 count大小进行排序
        for(var j=0;j< kp_data.length;j++){
            kp_data[j].kp_correct_rate = Math.round((kp_data[j].kp_count/kp_data[j].kp_count_all)*100);
            kp_data[j].stu_mistake=kp_data[j].stu_mistake.sort(compare('stu_count'));
            var  kp_num = (kp_data[j].kp_count_all)/(kp_data[j].stu_mistake.length);
            for(var i=0;i< kp_data[j].stu_mistake.length;i++){
                kp_data[j].stu_mistake[i].stu_rate = Math.round(((kp_num-kp_data[j].stu_mistake[i].stu_count)/kp_num)*100);
            }
        }
        res.send(kp_data);
    }); 
});

app.get('/klmanager/getTestDetail', function(req, res) {
    console.log(req.query.test_id);
    getTestDetail(req.query.test_id, function(results){
        console.log(results);
        var results0 = results[0]; //题目详情
        var results1 = results[1]; //获取题目正确率
        var results2 = results[2]; //获取各知识点完成率
        console.log('results0.length:'+results0.length);
        console.log('results1.length:'+results1.length);
        console.log('results2.length:'+results2.length);
        var test_data = [];
        var index_sn = [];
        for(var i = 0; i < results0.length; i++){
            var e = results0[i];
            const index = index_sn[e.exercise_id.toString()];
            if(index >= 0){
                test_data[index].breakdown.push({
                    sn :e.sn,
                    content : e.content,
                    kpid : e.kpid,
                    kpname : e.kpname,
                });
            }else{
                var breakdown = [{
                    sn :e.sn,
                    content : e.content,
                    kpid : e.kpid,
                    kpname : e.kpname,
                }];
                test_data.push({
                    exercise_id : e.exercise_id,
                    title : e.title,
                    answer : e.answer,
                    type : e.exercise_type,
                    title_img_url: e.title_img_url,
                    title_audio_url:e.title_audio_url,
                    correct_rate : 0, //此题正确率，需根据后面数据完善
                    stu_false : [],  //该题错误的同学，需根据后面数据完善
                    kp_rate : [],  // 每个sn（知识点）完成率，先为空
                    breakdown : breakdown,
                });  
                index_sn[e.exercise_id.toString()] = test_data.length -1;
            }
        }

        var stu_res = [];
        var index_stu = [];
        for(var i = 0; i < results1.length; i++){
            var e = results1[i];
            const index = index_stu[e.exercise_id.toString()];
            if(index >= 0){
                stu_res[index].count++;
                stu_res[index].right = e.exercise_state? stu_res[index].right+1 : stu_res[index].right;
                if(e.exercise_state == 0 ){
                    stu_res[index].stu_false.push({
                        student_id : e.student_id,
                        student_name : e.student_name,
                    });
                }
            }else{
                var count = 1;
                var right = e.exercise_state? 1 : 0;
                var stu_false = e.exercise_state? [] : [{
                        student_id : e.student_id,
                        student_name : e.student_name,
                    }];
                stu_res.push({
                    exercise_id : e.exercise_id,
                    count : count,
                    right : right,
                    stu_false : stu_false,
                });  
                index_stu[e.exercise_id.toString()] = stu_res.length -1;
            }
        }

        var kp_res = []; 
        var index_exer = [];
        var index_correct = [];
        for(var i = 0; i < results2.length; i++){  //根据 exercise_id 以及 sn 确定该项目知识点完成率，先转换成便于计算的数组。
            var e = results2[i];
            const index = index_exer[e.exercise_id.toString()]; 
            const index2 = index_correct[e.exercise_id+'-'+e.sn]; 
            if(index >= 0){
                if(index2 >=0){//能唯一确定元素时
                    kp_res[index].sn_correct[index2].count++;
                    kp_res[index].sn_correct[index2].right = e.sn_state ? kp_res[index].sn_correct[index2].right +1 : kp_res[index].sn_correct[index2].right;
                    kp_res[index].sn_correct[index2].rate = Math.round((kp_res[index].sn_correct[index2].right / kp_res[index].sn_correct[index2].count)*100);
                }
                else{
                    var newsn = {
                        sn : e.sn,
                        count : 1,
                        right : e.sn_state>0 ? 1 : 0,
                        rate : Math.round((right/count)*100),
                    }
                    kp_res[index].sn_correct.push(newsn);                
                    index_correct[e.exercise_id+'-'+e.sn] = kp_res[index].sn_correct.length - 1; 
                }
            }else{
                var sn_correct = [{
                    sn : e.sn,
                    count : 1,
                    right : e.sn_state>0 ? 1 : 0,
                    rate : Math.round((right/count)*100),
                }];
                var group = {
                    exercise_id : e.exercise_id,
                    sn_correct : sn_correct,
                };
                kp_res.push(group);
                index_exer[e.exercise_id.toString()] = kp_res.length - 1;
                index_correct[e.exercise_id+'-'+e.sn] = 0; //hashmap 记录下新增元素在 sn_correct 里的位置
            }
        }
        console.log('kp_res---------------------------');
        console.log('kp_res.length:'+kp_res.length);
        for(var i = 0; i < kp_res.length; i++){  //将result2 中的知识点完成率赋予到 test_data 中
            var e = kp_res[i];
            console.log('e:'+e);
            console.log('e.exercise_id:'+e.exercise_id);
            const index = index_sn[e.exercise_id.toString()];
            console.log('index:'+index);
            test_data[index].kp_rate = e.sn_correct;
        }
        console.log('stu_res---------------------------');
        for(var i = 0; i < stu_res.length; i++){  //将result1 中的题目正确率和该题错误的学生赋值给 test_data
            var e = stu_res[i];
            console.log('e:'+e);
            console.log('e.exercise_id:'+e.exercise_id);
            const index = index_sn[e.exercise_id.toString()];
            console.log('index:'+index);
            // console.log('test_data:'+JSON.stringify(test_data));
            console.log('test_data:'+test_data);
            if(e.count > 0){
                test_data[index].correct_rate = Math.round((e.right/e.count)*100);
            }else{
                test_data[index].correct_rate = 0;
            }
            test_data[index].stu_false = e.stu_false;
        }
        console.log(test_data);
        res.send(test_data);
    }); 
});

//以上表示凡是url能够匹配/hello/*的GET请求，服务器都将向客户端发送字符串“Hello World"  
//-------------------------------------------------------------------------------
//用户登录
app.post('/klmanager/login', function(req, res){   //用户名 密码 进行登录
    console.log('req.body.username:'+req.body.username);
    console.log('req.body.password:'+req.body.password);
    getUser(req.body.username,req.body.password, function(results){
        var str = JSON.stringify(results); 
        var result_json = JSON.parse(str);
        console.log('results:'+str);
        if(result_json.length){
            res.status(201).send({
                id_token: createIdToken(result_json[0]),
                token: createAccessToken(req.body.username,result_json[0].user_id)
            });
        }
        else{
            res.status(401).send("The username or password don't match");
        }
    });
}); 

app.post('/klmanager/jwtcheck', (req, res) => {    //用户携带token进行鉴权
    let token = req.headers['authorization'];
    console.log('token:'+token);
    if (!token) {
        res.sendStatus(401);
    } else {
        try {
            token = token.replace('Bearer ', '');                      
            let decoded = jwt.verify(token, config.secret);
            console.log(decoded);
            res.status(200).send({"status":"jwt ok"});
        } catch (e) {
            res.sendStatus(401);
        }
    }
})

//用于用户账号密码注册
app.post('/klmanager/newuser', function(req, res) {  

  if (!req.body.username || !req.body.password) {
    return res.status(400).send("You must send the username and the password");
  }

  getUserName(req.body.username, function(results){
        var str = JSON.stringify(results); 
        var result_json = JSON.parse(str);
        if(result_json.length){
            return res.status(400).send({user_exists:"A user with that username already exists"});
        }else{
            setNewUser(req.body.username,req.body.password, function(results){
                const user_id = results.insertId
                var profile = {
                        user_id:user_id,
                        username:req.body.username,
                        password:req.body.password
                        }
                res.status(201).send({
                    id_token: createIdToken(profile),
                    token: createAccessToken(req.body.username)
                });
            });
        }
  });
});

//-------------------------------------------------------------------------------

app.post('/klmanager/add', function(req, res) {
    console.log(req.body);
    if (req.body.chapterid) {
    	console.log(req.body.chapterid);
        //能正确解析 json 格式的post参数
        addKp(req.body.chapterid, req.body.form, function(results){
            var row = results[0];
            console.log(row[0].kp_id);
            res.send({"status": "success", "kpid": row[0].kp_id});
        });
    }
});

app.post('/klmanager/delete', function(req, res) {
    if (req.body.kpid) {
    	console.log(req.body.kpid);
    	deleteKp(req.body.kpid, function(results){
            console.log(results);
            res.send({"status": "delete success"});
        });
    }
});

app.post('/klmanager/modify', function(req, res) {
    console.log(req.body);
    if (req.body.kpid) {
        console.log(req.body.kpid);

        modifyKp(req.body, function(results){
            res.send({"status": "modify success"});
        });
    }
});

//新增测试，保存测试信息
app.post('/klmanager/addNewTest', function(req, res) {
    console.log(req.body);
    if (req.body.test_name) {
        addNewTest(req.body.test_name,req.body.teacher_id,req.body.test_exercise.length,function(results){
            const testid = results.insertId
            addExerciseTest(testid, req.body.test_exercise, function(){
                res.send({"test_id": testid});
            });
        });     
    }
});

//试题分发，更新学生、老师和试题的关系
app.post('/klmanager/distributeTest', function(req, res) {
    console.log(req.body);
    if (req.body.test_id) {
        changeTestState(req.body.test_id,function(results){
            getTestLength(req.body.test_id,function(testsize){
                console.log("testsize:"+JSON.stringify(testsize));
                addStudentTest(req.body.test_id, req.body.keys, testsize[0].size, function(){
                    console.log("enable_time results:"+JSON.stringify(results));
                    res.send({"enable_time": results[1][0].enable_time});
                });
            });
        });    
    }
});

//删除测试列表中的一项
app.post('/klmanager/deleteOneTest', function(req, res) {
    if (req.body.test_id) {
        console.log(req.body.test_id);
        deleteOneTest(req.body.test_id, function(results){
            console.log(results);
            res.send({"status": "delete success"});
        });
    }
});

//在老师管理界面下新增班级分组
app.post('/klmanager/addNewGroup', function(req, res) {
    console.log(req.body);
    if (req.body.group_name) {
        addNewGroup(req.body.group_name,req.body.teacher_id,function(results){
            res.send({"stu_group_id":results.insertId});
        });     
    }
});

//在老师管理界面下删除指定班级分组
app.post('/klmanager/deleteOneGroup', function(req, res) {
    if (req.body.stu_group_id) {
        console.log(req.body.stu_group_id);
        deleteOneGroup(req.body.stu_group_id, function(results){
            console.log(results);
            res.send({"status": "delete success"});
        });
    }
});

//删除班级分组里单个学生信息
app.post('/klmanager/deleteOneStudent', function(req, res) {
    if (req.body.student_id) {
        console.log(req.body.student_id);
        deleteOneStudent(req.body.student_id, function(results){
            console.log(results);
            res.send({"status": "delete success"});
        });
    }
});

//新增班级分组里单个学生信息
app.post('/klmanager/addOneStudent', function(req, res) {
    if (req.body.student_id) {
        console.log(req.body.student_id);
        addOneStudent(req.body.student_id,req.body.student_name,req.body.phone_num,req.body.stu_group_id,function(results){
            console.log(results);
            res.send({"status": "add success"});
        });
    }
});

}
//app.get('/', function(req, res){  
// res.render('index', {  
//    title: 'Express'  
//  });  
//});  
//上面的代码意思是，get请求根目录则调用views文件夹中的index模板，并且传入参数title为“Express”，这个title就可以在模板文件中直接使用
