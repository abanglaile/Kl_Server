var mysql = require('mysql');
// var pool  = mysql.createPool({
//   host     : '127.0.0.1',
//   user     : 'root',
//   password : 'root',
//   database : 'knowledge_bak',
//   timezone : '08:00',
//   multipleStatements: true
// });
var moment = require('moment');
var pool  = mysql.createPool({
  host     : 'rm-wz9irm56yc8scnyy6.mysql.rds.aliyuncs.com',
  user     : 'root',
  password : '!QAZ2wsx',    
  database : 'knowledge',
  timezone : "08:00",
  multipleStatements: true
});

process.env.TZ = 'Asia/Shanghai '



/** 
 * 日期解析，字符串转日期 
 * @param dateString 可以为2017-02-16，2017/02/16，2017.02.16 
 * @returns {Date} 返回对应的日期对象 
 */  
function dateParse(dateString){
    var timeZone = 8;
    var d = new Date(Date.parse(dateString));  
            localTime = d.getTime(),  
            localOffset=d.getTimezoneOffset()*60000, //获得当地时间偏移的毫秒数,这里可能是负数  
            utc = localTime + localOffset, //utc即GMT时间  
            offset = timeZone, //时区，北京市+8  美国华盛顿为 -5  
            localSecondTime = utc + (3600000*offset);  //本地对应的毫秒数  
        var date = new Date(localSecondTime);    
    return date;  
};  

function query(pool, sql, values, callback){
    pool.getConnection(function(err, connection) {
    //console.log(sql);
    // console.log(values);
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

function getMyBookChapter(student_id, course_id, callback){
    // var sql = "select b.bookname, ch.bookid, ch.chapterid, ch.chaptername,rate.practice,rate.correct from chapter ch,"
    //  + "book b,(select  sum(sk.`practice`) as practice,sum(sk.`correct`) as correct, k.chapterid,"
    //  + "sk.student_id  from kptable k LEFT JOIN student_kp sk on k.kpid = sk.kpid "
    //  + "where sk.student_id = ? GROUP BY k.chapterid ) as rate where b.course_id = ? and "
    //  + "rate.chapterid=ch.chapterid  and ch.bookid = b.bookid order by chapterid asc";

    var sql = "select bookkp.*,rate.practice,rate.correct from (SELECT b.bookname,ch.bookid,ch.chapterid,"
            +"ch.chaptername from book b,chapter ch where b.bookid = ch.bookid  and b.course_id = ?) "
            +"as bookkp LEFT JOIN (select sum(sk.`practice`) as practice,sum(sk.`correct`) as correct,"
            +" k.chapterid,sk.student_id  from kptable k LEFT JOIN student_kp sk on k.kpid = sk.kpid "
            +"where sk.student_id = ? GROUP BY k.chapterid) as rate on bookkp.chapterid=rate.chapterid;";

    var values = [];
    values.push(course_id,student_id);

    query(pool, sql, values, callback);
}
function getMyLadderScore(student_id, callback){
    var sql = "select t.student_rating from student_rating t where t.student_id = ? ORDER BY update_time DESC LIMIT 1";
    var values = [];
    values.push(student_id);

    query(pool, sql, values, callback);
}


function getChapterName(chapter_id, callback){
    var sql = "select c.chaptername from chapter c where c.chapterid = ?;";
    var values = [];
    values.push(chapter_id);

    query(pool, sql, values, callback);
}

function getChapterStatus(student_id, chapter_id, callback){
    var sql = "select sum(sk.practice) as practice, sum(sk.correct) as correct from chapter c, "
    + "kptable k LEFT JOIN student_kp sk on k.kpid = sk.kpid and sk.student_id = ? "
    + "where c.chapterid = ? and k.chapterid = c.chapterid;";
    var values = [];
    values.push(student_id, chapter_id);

    query(pool, sql, values, callback);
}

function getChapterKpStatus(student_id, chapter_id, callback){
    var sql = "select k.kpid, k.kpname, sk.kp_rating, sk.practice, sk.correct from chapter c, "
            + "kptable k LEFT JOIN student_kp sk on k.kpid = sk.kpid and sk.student_id = ? "
            + "where c.chapterid = ? and k.chapterid = c.chapterid;";
    var values = [];
    values.push(student_id, chapter_id);
    
    query(pool, sql, values, callback);
}

function getExerciseByKp(kpid, callback){
    var sql = "select e.* , b.*, t.kpname from kp_exercise k, exercise e, breakdown b, kptable t where k.kpid = ? and e.exercise_id = k.exercise_id and b.exercise_id = e.exercise_id and b.kpid = t.kpid";    
    query(pool, sql, [kpid], callback);
}


function getKpExercise(exercise_id, callback){
    var sql = "select kpid from kp_exercise k where exercise_id = ?";
    query(pool, sql, [exercise_id], callback);
}

function getTestLogs(student_id, callback){
    var sql = "select t.*, s.start_time, s.finish_time, s.test_state, s.correct_exercise, s.total_exercise ,date_format(s.finish_time,'%m/%d') as formatdate from teacher_test t, test_log s where s.student_id = ? and t.test_id = s.test_id and s.finish_time is not null ORDER BY s.finish_time DESC;";
    query(pool, sql, [student_id], callback);
}

function getUncompletedTestLogs(student_id, callback){
    var sql = "select t.*, u.nickname,s.start_time, s.finish_time, s.test_state, s.correct_exercise, s.total_exercise ,"
                +"date_format(t.`enable_time`, '%m/%d') as formatdate from teacher_test t, test_log s,"
                +"users u where s.student_id = ? and u.id = t.`teacher_id`  and t.test_id = s.test_id and s.`finish_time` is null and t.test_type = 1 and t.`enable_time` IS NOT NULL ORDER BY t.enable_time DESC;";
    query(pool, sql, [student_id], callback);
}

function getTestLog(student_id, test_id, callback){
    var sql = "select t.*, tt.test_type, tt.test_config, tt.test_name from test_log t, teacher_test tt where t.student_id = ? and tt.test_id = t.test_id and t.test_id = ?;";
    query(pool, sql, [student_id, test_id], callback);
}

function getExerciseByTest(test_id, student_id, callback){
    var sql = "select e.* , et.exercise_index, b.*, t.kpname, sk.kp_rating from exercise_test et, "
                + "exercise e, kptable t, "
                + "breakdown b left join (select * from student_kp where student_id = ?) as sk on b.kpid = sk.kpid "
                + "where et.test_id = ? and e.exercise_id = et.exercise_id and b.exercise_id = e.exercise_id and b.kpid = t.kpid order by b.sn;";    
    query(pool, sql, [student_id, test_id], callback);
}

//根据知识点添加测试test
function addNewTestByKp(kpid, kpname,callback){
    const test_name = "攻克" + kpname;
    var sql = "insert into teacher_test set test_name=?, teacher_id= -1, "
        + "group_time=(SELECT now()), enable_time=(SELECT now()), total_exercise = 3, test_type=2, test_config=?;";
    query(pool, sql,[test_name, JSON.stringify({kp: [{kpid: kpid, kpname: kpname}]})],callback);
}
//获得主测知识点下的exercise-ids  目前是限制6题    
function generateExerByKp(kpid,callback){
    var sql = "select k.exercise_id from kp_exercise k where k.kpid = ? LIMIT 3";
    query(pool, sql, [kpid], callback);
}
//添加 testid与exercise对应关系,test包含哪些测试
function generateExerciseTest(test_id, student_id, exercises,callback){
    var sql = "insert into test_log set ?;";
    var params = [{student_id: student_id, test_id: test_id, start_time: new Date(), total_exercise: exercises.length}];
    for(var i = 0; i < exercises.length; i++){
        sql = sql + "insert into exercise_test set ?;"
        params.push({test_id: test_id, exercise_id: exercises[i].exercise_id, exercise_index: i});   
    }
    query(pool, sql, params, callback);
}

function getExerciseByKpid(student_id, kpid, callback){
    var sql1 = "select k.exercise_id from kp_exercise k where k.kpid = ? LIMIT 6";
    var sql = "select e.* , e.exercise_rating, b.*, t.kpname, sk.kp_rating from exercise_test et, "
                + "exercise e, kptable t, "
                + "breakdown b left join (select * from student_kp where student_id = ?) as sk on b.kpid = sk.kpid "
                + "where et.test_id = ? and e.exercise_id = et.exercise_id and b.exercise_id = e.exercise_id and b.kpid = t.kpid order by b.sn";    
    query(pool, sql, [student_id, test_id], callback);
}

function getExerciseByID(exercise_id, student_id, callback){
    var sql = "select e.* , b.*, t.kpname, sk.kp_rating from "
                + "exercise e, kptable t, "
                + "breakdown b left join student_kp sk on b.kpid = sk.kpid "
                + "where e.exercise_id = ? and b.exercise_id = e.exercise_id and b.kpid = t.kpid and sk.student_id = ? and sk.kpid = b.kpid order by b.sn";    
    query(pool, sql, [exercise_id, student_id], callback);
}

//指定样本id获取题目信息
//TO-DO: 加入sample_id
function getExerciseSample(exercise_id, callback){
    var sql = "select e.* from exercise e where e.exercise_id = ?";    
    query(pool, sql, [exercise_id], callback);
}

//获取测试记录
function getExerciseLogResult(student_id, test_id, callback){
    var sql = "select bl.*, el.* ,k.kpname, et.exercise_index from exercise_log el, breakdown_log bl ,kptable k, exercise_test et where et.test_id = el.test_id and et.exercise_id = el.exercise_id and el.student_id = ? and el.test_id = ? and bl.logid = el.logid and k.kpid = bl.kpid;";
    query(pool, sql, [student_id, test_id], callback);
}

//获取测试基本信息
function getTeacherTest(test_id, callback){
    var sql = "select t.* from teacher_test t where t.test_id = ?;select count(*) as size from exercise_test et where et.test_id = ?";
    query(pool, sql, [test_id, test_id], callback);
}

//获取测试状态
function getTestStatus(test_id, callback){
    var sql = "select tl.*,timestampdiff(SECOND,tl.start_time,tl.finish_time) as time_consuming from test_log tl where tl.test_id = ?;";
    query(pool, sql, [test_id], callback);
}

//获取单个测试已提交学生的排名表；按题目正确数降序排名
function getTestRankingList(test_id, callback){
    var sql = "SELECT s.`finish_time` ,s.`start_time`,timestampdiff(SECOND,s.start_time,s.finish_time) as time_consuming,"
            +"s.`correct_exercise`,s.`total_exercise` ,g.`student_name`  from `test_log` s ,group_student g where s.`test_id` = ? and g.`student_id` = s.`student_id`  and s.`correct_exercise` is not null and s.`finish_time` is not null ORDER BY correct_exercise DESC LIMIT 7;";
    query(pool, sql, [test_id], callback);
}

//根据testid studentid 获取该测试是否已做（isFinish）以及学生天梯分
function getStuTestInfo(student_id,test_id, callback){
    var sql = "SELECT s.`student_id` ,s.`student_rating` from `student_rating` s where s.`student_id` =? and s.`update_time` =(SELECT max(`update_time`) from `student_rating` r where r.`student_id` = s.`student_id` );"
                +"SELECT l.finish_time from `test_log` l where l.`test_id` =? and l.`student_id` =?;";
    query(pool, sql, [student_id,test_id,student_id], callback);
}

//获取测试相关知识点状态
function getTestKpStatus(student_id, test_id, callback){
    var sql = "select b.kpid, kt.kpname, sk.kp_rating, sk.practice, sk.correct from exercise_test t, exercise e, kptable kt, " 
                    + "breakdown b LEFT JOIN (select * from student_kp where student_id = ?) as sk on sk.kpid = b.kpid "
                + "where t.test_id = ? and t.exercise_id = e.exercise_id and e.exercise_id = b.exercise_id and kt.kpid = b.kpid;";
    query(pool, sql, [student_id, test_id], callback);
}

function getStudentRating(student_id, callback){
    var sql = "select sk.rating from student_rating sk where student_id = ?";
    query(pool, sql, [student_id], callback);
}

//根据学生id,kpid 获取学生知识点能力综合概况（天梯分，正确率，练习次数）
function getKpAbility(student_id, kpid, callback){
    var sql = "select s.`kp_rating` , s.`practice` , s.`correct`,k.kpname,"
            +" c.chaptername  from `student_kp` s,kptable k,`chapter` c where s.`student_id` =?"
            +" and s.`kpid` = ? and  s.kpid=k.kpid and k.chapterid=c.chapterid;";
    query(pool, sql, [student_id,kpid], callback);
}

function insertExerciseLog(student_id, test_id, exercise_log, callback){
    console.log(exercise_log.start_time);
    var sql = "insert into exercise_log set ?;"
    var params = [];
    params.push({
        student_id: student_id, 
        test_id: test_id, 
        exercise_id: exercise_log.exercise_id, 
        exercise_state: exercise_log.exercise_state,
        submit_time: dateParse(exercise_log.submit_time),
        start_time: dateParse(exercise_log.start_time),
        ac_time: exercise_log.ac_time,
        // finish_time: dateParse(exercise_log.finish_time), 
        answer: JSON.stringify(exercise_log.answer),
        delta_exercise_rating: exercise_log.delta_exercise_rating,
        old_exercise_rating: exercise_log.old_exercise_rating,
        delta_student_rating: exercise_log.delta_student_rating,
        old_student_rating: exercise_log.old_student_rating,
    });

    query(pool, sql, params, callback); 
}

function insertBreakdownLog(logid, breakdown_sn, student_id, test_id, exercise_id, kp_rating){
    var sql = "";
    var params = [];
    for(var j = 0; j < breakdown_sn.length; j++){
            sql += "insert into breakdown_log(logid, student_id, test_id, exercise_id, sn, kpid, sn_state, kp_old_rating, kp_delta_rating, sn_old_rating, sn_delta_rating) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
            // params = [
            //             logid, 
            //             breakdown_sn[j].sn, 
            //             breakdown_sn[j].kpid, 
            //             breakdown_sn[j].sn_state, 
            //             breakdown_sn[j].kp_old_rating, 
            //             breakdown_sn[j].kp_delta_rating, 
            //             breakdown_sn[j].sn_old_rating, 
            //             breakdown_sn[j].sn_delta_rating
            //         ];
            params.push(logid);
            params.push(student_id);
            params.push(test_id);
            params.push(exercise_id);
            params.push(breakdown_sn[j].sn);
            params.push(breakdown_sn[j].kpid);
            params.push(breakdown_sn[j].sn_state);
            params.push(breakdown_sn[j].kp_old_rating);
            params.push(breakdown_sn[j].kp_delta_rating);
            params.push(breakdown_sn[j].sn_old_rating);
            params.push(breakdown_sn[j].sn_delta_rating);
            // //插入每个步骤rating变化记录
            // sql += "insert into sn_delta_rating(exercise_id, sn, delta_rating) values(?, ?, ?);";
            // params.push(exercise_id);
            // params.push(breakdown_sn[j].sn);
            // params.push(breakdown_sn[j].sn_delta_rating);
            
            sql += "insert into breakdown_log_trigger(logid, sn) values(?, ?);";
            params.push(logid, breakdown_sn[j].sn);
            // var kpid = "#" + breakdown_sn[j].kpid;
            // if(kp_rating[kpid]){
            //     kp_rating[kpid].kp_delta_rating += breakdown_sn[j].kp_delta_rating;
            // }
            // else{
            //     //初始化
            //     kp_rating[kpid] = {
            //         kp_old_rating: breakdown_sn[j].kp_old_rating,
            //         kp_delta_rating: breakdown_sn[j].kp_delta_rating,
            //         kpname: breakdown_sn[j].kpname,
            //     }
            // }
    }
    query(pool, sql, params, results => {
        console.log("insertBreakdownLog success");
    });
}

function insertExerciseLogTrigger(logid){
    var sql = "";
    sql += "insert into exercise_log_trigger(logid) values(?);";
    query(pool, sql, [logid], results => {
        //console.log("insertExerciseLog success");
    });
}

// function submitStudentTest(student_id, student_rating, test_result, callback){
//     //测试者天梯分数变化
//     var student_delta_rating = 0;
//     //汇总测试者kp_raintg
//     var kp_rating = [];
//     //计算题目步骤rating
//     const test_log = updateKpRating(test_result.test_log);
//     //更新测试总体情况
//     var sql = "update student_test set ? where student_id = ?;";
//     var params = [{start_time: test_result.start_time, finish_time: test_result.finish_time, test_state: test_result.test_state}, student_id];
//     for(var i = 0; i < test_log.length; i++){
//         //sql += "insert test_log set ?;"
//         //测试使用
//         sql += "replace into test_log set ?;"
//         params.push({
//             student_id: student_id, 
//             test_id: test_result.test_id, 
//             exercise_id: test_log[i].exercise_id, 
//             exercise_state: test_log[i].exercise_state, 
//             answer: test_log[i].answer,
//             delta_exercise_rating: test_log[i].delta_exercise_rating,
//             old_exercise_rating: test_log[i].old_exercise_rating,
//             delta_student_rating: test_log[i].delta_student_rating,
//             old_student_rating: test_log[i].old_student_rating,
//         });

//         const breakdown_sn = test_log[i].breakdown_sn;
//         for(var j = 0; j < breakdown_sn.length; j++){
//             //测试使用 真实中使用insert
//             sql += "replace into breakdown_log set ?;"
//             params.push({
//                 student_id: student_id, 
//                 test_id: test_id, 
//                 exercise_id: test_log[i].exercise_id, 
//                 sn: breakdown_sn[j].sn, 
//                 kpid: breakdown_sn[j].kpid, 
//                 sn_state: breakdown_sn[j].sn_state, 
//                 kp_old_rating: breakdown_sn[j].kp_old_rating,
//                 kp_delta_rating: breakdown_sn[j].kp_delta_rating,
//                 sn_old_rating: breakdown_sn[j].sn_old_rating,
//                 sn_delta_rating: breakdown_sn[j].sn_delta_rating,
//             });

//             //插入每个步骤rating变化记录
//             sql += "insert into sn_delta_rating(exercise_id, sn, delta_rating) values(?, ?, ?);";
//             params.push(test_log[i].exercise_id);
//             params.push(breakdown_sn[j].sn);
//             params.push(breakdown_sn[j].sn_delta_rating);

//             const kpid = breakdown_sn[i].kpid.toString();
//             if(kp_rating[kpid]){
//                 kp_rating[kpid] += breakdown_sn[i].kp_delta_rating;
//             }
//             else{
//                 //初始化
//                 kp_rating[kpid] = breakdown_sn[i].kp_old_rating + breakdown_sn[i].kp_delta_rating;
//             }

//             // //插入每个知识点rating变化记录
//             // sql += "insert into kp_delta_rating(student_id, kpid, kp_delta_rating) values(?, ?, ?);";
//             // params.push(student_id);
//             // params.push(breakdown_sn[j].kpid);
//             // params.push(breakdown_sn[j].kp_delta_rating);

//             // sql += "replace into student_kp set rating = rating + ? where student_id = ? and kpid = ?;";
//             // params.push(breakdown_sn[j].delta_rating, student_id, breakdown_sn[j].kpid);

//         }


//         //插入每条题目rating变化记录
//         sql += "insert into exercise_delta_rating(exercise_id, delta_rating) values(?, ?);";
//         params.push(test_log[i].exercise_id);
//         params.push(test_log[i].delta_exercise_rating);
//     }
//     //更新测试者rating
//     sql += "insert into student_rating(student_id, student_rating) values(?, ?);";
//     params.push(student_id);
//     params.push(test_result.student_rating);
//     //TO-DO：更新测试者kp_rating
//     for(var kpid in kp_rating){
//         sql += "insert into student_rating(student_id, kpid, rating) values(?, ?, ?);";
//         params.push(student_id, parseInt(kpid), kp_rating[kpid]);
//     }

//     //汇总sn_delta_rating
//     sql += "update breakdown b, test t set b.sn_rating = b.sn_rating + (select sum(s.delta_rating) from sn_delta_rating s where s.exercise_id = b.exercise_id and s.sn = b.sn) where t.test_id = ? and b.exercise_id = t.exercise_id";
//     params.push(test_result.test_id);
//     query(pool, sql, params, callback);    

//     //TO-DO：汇总exercise_delta_rating
    
// }

//利用elo_rating方法更新rating
function elo_rating(ra, rb){
    const m = (ra - rb)/400;
    return 1/(1 + Math.pow(10, m));
}

function updateKpRating(test_log){
    var kp_rating = [];
    const K = 32;
    for(var i = 0; i < test_log.length; i++){
        const breakdown_sn = test_log[i].breakdown_sn;
        for(var j = 0; j < breakdown_sn.length; j++){
            var log = breakdown_sn[j];
            //只记录已评估的知识点
            if(log.sn_state >= 0){
                //学生知识点与知识点在题目中体现的难度变化
                const kp_SA = log.sn_state ? 1 : 0;
                const sn_SA = log.sn_state ? 0 : 1;
                
                const kp_delta = elo_rating(log.kp_old_rating, log.sn_old_rating);
                const sn_delta = elo_rating(log.sn_old_rating, log.kp_old_rating);
                log.kp_delta_rating = K*(kp_SA - kp_delta);
                log.sn_delta_rating = K*(sn_SA - sn_delta);

                // //汇总kp_rating
                // var kpid = "#" + log.kpid;
                // if(kp_rating[kpid]){
                //     kp_rating[kpid].kp_delta_rating += Math.ceil(log.kp_delta_rating);
                // }
                // else{
                //     //初始化
                //     kp_rating[kpid] = {
                //         kp_old_rating: log.kp_old_rating,
                //         kp_delta_rating: Math.ceil(log.kp_delta_rating),
                //         kpname: log.kpname,
                //     }
                // }
            }else{
                log.kp_delta_rating = 0;
                log.sn_delta_rating = 0;
            }
        }
    }
    return kp_rating;
}


module.exports = function(app){
app.get('/klmanager/getMyHistoryTests', function(req, res){
    getTestLogs(req.query.student_id, function(results){
        console.log("results:"+JSON.stringify(results));
        res.send(results);
    });
});

//获取老师布置的未完成的测试
app.get('/klmanager/getUncompletedTest', function(req, res){
    console.log(req.query.student_id);
    getUncompletedTestLogs(req.query.student_id, function(results){
        console.log("results:"+JSON.stringify(results));
        res.send(results);
    });
});

app.get('/klmanager/getMyLadderScore', function(req, res){  
    getMyLadderScore(req.query.student_id, function(results){
        console.log("MyLadderScore:"+JSON.stringify(results[0]));
        res.send(results[0]);
    });
    
});

app.get('/klmanager/getChapterName', function(req, res){  
    getChapterName(req.query.chapter_id, function(results){
        console.log("ChapterName:"+JSON.stringify(results[0]));
        res.send(results[0]);
    });
    
});

app.get('/klmanager/getChapterStatus', function(req, res){  
    getChapterStatus(req.query.student_id, req.query.chapter_id, function(results){
        res.send(results[0]);
    });
    
});

app.get('/klmanager/getChapterKpStatus', function(req, res){  
    getChapterKpStatus(req.query.student_id, req.query.chapter_id, function(results){
        res.send(results);
    });
    
});

app.get('/klmanager/getMyBookChapter', function(req, res){  
    console.log(req.query.course_id);

    getMyBookChapter(req.query.student_id, req.query.course_id, function(results){
        console.log(results);
        var rep = [];
        for(var i = 0; i < results.length; i++){
            var chapter = results[i];
            var m = true;
            console.log(rep);
            for(var j = 0; j < rep.length; j++){
                var book = rep[j];
                if(book.bookid == chapter.bookid){
                    let rate = chapter.practice ? Math.round((chapter.correct/chapter.practice)*100) : 0;
                    book.chapters.push({chapterid: chapter.chapterid, chaptername: chapter.chaptername,chapterrate:rate});
                    m = false;
                    break;
                }
            }
            //插入新的bookid
            if(m){
                let rate = chapter.practice ? Math.round((chapter.correct/chapter.practice)*100) : 0;
                var book = {bookid: chapter.bookid, bookname: chapter.bookname, chapters: [{
                    chapterid: chapter.chapterid, 
                    chaptername: chapter.chaptername,
                    chapterrate: rate
                }]};
                rep.push(book);
            }
        }
        
        res.send(rep);
    });
});

/**
 * exerciseList = [{
 *     exercise_id: 1001,
 *     type: 0, //0: 填空，1: 选择题
 *     title: '求解一元二次方程$x^2 + 3x + 2 = 0$',
 *     answer: '[-2, -1]',
 *     exercise_rating: 900,//题目的rating
 *     breakdown: [{
 *          sn: 1,
 *          content: '$(x + 1)(x + 2) = 0$',
 *          presn: 0, 
 *          kpid: '1820830212',
 *          kpname: '因式分解求解一元二次方程',
 *          sn_rating: 1200,//分解步骤rating
 *          kp_rating: 800,//学生知识点rating
 *     }],
 * }]
 * 
 */
//根据test_id获取题目
app.get('/klmanager/getExerciseByTest', function(req, res) {
    if (req.query.student_id) {
        const default_rating = 500;
        console.log(req.query.test_id);
        getExerciseByTest(req.query.test_id, req.query.student_id, function(results){
            getMyLadderScore(req.query.student_id, function(rating){
                var exercise_list = [];
                for(var i = 0; i < results.length; i++){
                    var e = results[i];
                    var index = e.exercise_index;
                    console.log("index:" + index);
                    if(exercise_list[index]){
                        exercise_list[index].breakdown[e.sn - 1] = {
                            sn: e.sn, 
                            content: e.content, 
                            presn: e.presn, 
                            kpid: e.kpid,
                            kpname: e.kpname,
                            sn_rating: e.sn_rating,
                            kp_rating: e.kp_rating ? e.kp_rating : default_rating,
                        }
                    }else {
                        var breakdown = [];
                        breakdown[e.sn - 1] = {
                            sn: e.sn, 
                            content: e.content, 
                            presn: e.presn, 
                            kpid: e.kpid,
                            kpname: e.kpname,
                            sn_rating: e.sn_rating,
                            kp_rating: e.kp_rating ? e.kp_rating : default_rating,
                        };
                        exercise_list[index] = {
                            exercise_id: e.exercise_id, 
                            exercise_type: e.exercise_type, 
                            title: e.title,
                            title_img_url: e.title_img_url,
                            title_audio_url: e.title_audio_url, 
                            answer: JSON.parse(e.answer),
                            breakdown: breakdown,
                            exercise_rating: e.exercise_rating,
                        };
                    }
                }
                // console.log(exercise_list);
                res.send({
                    exercise: exercise_list,
                    test_id: req.query.test_id,
                    student_rating: rating[0].student_rating,
                });
            });
            
        });     
    }
});

//根据kpid获取题目(该知识点下带的题目3题)
app.get('/klmanager/getExerciseByKpid', function(req, res) {
    console.log(req.query.kpid);
    if (req.query.kpid) {
        const default_rating = 500;
        addNewTestByKp(req.query.kpid, req.query.kpname, function(results){
            const testid = results.insertId;
            generateExerByKp(req.query.kpid, function(exercises){
                generateExerciseTest(testid, req.query.student_id, exercises, function(){
                    getExerciseByTest(testid, req.query.student_id, function(results){
                        getMyLadderScore(req.query.student_id, function(rating){
                            var exercise_list = [];
                            for(var i = 0; i < results.length; i++){
                                var e = results[i];
                                var index = e.exercise_index;
                                if(exercise_list[index]){
                                    exercise_list[index].breakdown[e.sn - 1] = {
                                        sn: e.sn, 
                                        content: e.content, 
                                        presn: e.presn, 
                                        kpid: e.kpid,
                                        kpname: e.kpname,
                                        sn_rating: e.sn_rating,
                                        kp_rating: e.kp_rating ? e.kp_rating : default_rating,
                                    }
                                }else {
                                    var breakdown = [];
                                    breakdown[e.sn - 1] = {
                                        sn: e.sn, 
                                        content: e.content, 
                                        presn: e.presn, 
                                        kpid: e.kpid,
                                        kpname: e.kpname,
                                        sn_rating: e.sn_rating,
                                        kp_rating: e.kp_rating ? e.kp_rating : default_rating,
                                    };
                                    exercise_list[index] = {
                                        exercise_id: e.exercise_id, 
                                        exercise_type: e.exercise_type, 
                                        title: e.title,
                                        title_img_url: e.title_img_url,
                                        title_audio_url: e.title_audio_url, 
                                        answer: JSON.parse(e.answer),
                                        breakdown: breakdown,
                                        exercise_rating: e.exercise_rating,
                                    };
                                }
                            }
                            // console.log(exercise_list);
                            res.send({
                                exercise: exercise_list,
                                test_id: testid,
                                student_rating: rating[0].student_rating,
                            });
                        });
                    });     
                });
            });
        });
    }
});

function getTestKpReward(student_id, test_id, callback){
    var sql = "SELECT sum(bl.kp_delta_rating) as kp_delta_rating, bl.kp_old_rating, bl.kpid, kt.kpname FROM exercise_log el, breakdown_log bl, kptable kt " 
        + "where el.student_id = ? and el.test_id = ? and bl.logid = el.logid and kt.kpid = bl.kpid GROUP BY bl.kpid;";
    query(pool, sql, [student_id, test_id], callback);
}

function getTestStuRating(student_id, test_id, callback){
    var sql = "SELECT sum(el.delta_student_rating) as delta_student_rating, el.old_student_rating FROM exercise_log el " 
        + "where el.student_id = ? and el.test_id = ?";
    query(pool, sql, [student_id, test_id], callback);
}

function getTestRatingReward(student_id, test_id, callback){
    var sql = "SELECT sum(el.delta_student_rating) as delta_student_rating, el.old_student_rating FROM exercise_log el " 
        + "where el.student_id = ? and el.test_id = ?";
    query(pool, sql, [student_id, test_id], callback);
}

app.get('/klmanager/getTestKpReward', function(req, res){
    if(req.query.student_id && req.query.test_id) {
        const student_id = req.query.student_id;
        const test_id = req.query.test_id;
        getTestKpReward(student_id, test_id, function(kp_r){
            res.send(kp_r[0]);
        });
    }
});

// app.get('/klmanager/getTestStuRating', function(req, res){
//     if(req.query.student_id && req.query.test_id) {
//         getTestStuRating(req.query.student_id, req.query.test_id, function(stu_r){
//             res.send(stu_r[0]);
//         });
//     }
// });

app.get('/klmanager/getTestRatingReward', function(req, res){
    console.log(req.query.student_id);
    if(req.query.student_id && req.query.test_id) {
        getTestRatingReward(req.query.student_id, req.query.test_id, function(stu_r){
            getTestKpReward(req.query.student_id, req.query.test_id, function(kp_r){
                console.log(stu_r[0]);
                console.log(kp_r);
                res.send({
                    kp_rating: kp_r,
                    rating: stu_r[0],
                    credit: {
                        delta_credit: 5,
                        old_credit: 30,
                        new_credit: 35,
                    }
                });
            })
        });
    }
});

//根\取题目
app.get('/klmanager/getExerciseByID', function(req, res) {
    if (req.query.student_id) {
        const default_rating = 500;
        console.log(req.query.exercise_id);
        getExerciseByID(req.query.exercise_id, req.query.student_id, function(results){
            var exercise_list = [];
            var breakdown = [];
            for(var i = 0; i < results.length; i++){
                var e = results[i];
                breakdown.push({
                    sn: e.sn, 
                    content: e.content, 
                    presn: e.presn, 
                    kpid: e.kpid,
                    kpname: e.kpname,
                    sn_rating: e.sn_rating,
                    kp_rating: e.kp_rating ? e.kp_rating : default_rating,
                });
            }
            exercise_list[0] = {
                exercise_id: results[0].exercise_id,
                exercise_type: results[0].type,
                title: results[0].title, 
                answer: JSON.parse(results[0].answer),
                breakdown: breakdown,
                exercise_rating: results[0].exercise_rating,
            };
            console.log(exercise_list);
            res.send(exercise_list);
        });
    }
});

//根据exercise_id与sample_id获取题目
app.get('/klmanager/getExerciseSample', function(req, res) {
    if (req.query.exercise_id) {
        getExerciseSample(req.query.exercise_id, function(results){
            res.send(results[0]);
        });
    }
});

//获取学生rating
app.get('/klmanager/getStudentRating', function(req, res){
    if(req.query.student_id){
        getStudentRating(student_id, function(results){
            res.send(results[0]);
        })
    }
});

//根据kpid获取题目
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
                        type: e.type, 
                        title: e.title, 
                        answer: JSON.parse(e.answer),
                        breakdown: breakdown
                    };
                    exercise_list[list_index] = exercise;
                    exercise_index[e.exercise_id] = list_index;
                    list_index++;
                }
            }
            res.send(exercise_list);
        });        
    }
});

//查询测试状态数据
app.post('/klmanager/getTestStatus', function(req, res){
    if(req.body.test_id){
        getTeacherTest(req.body.test_id, test => {
            getTestStatus(req.body.test_id, test_log => {
                console.log("getTestStatus test_log:"+JSON.stringify(test_log));
                var accurracy = 0;//总答对数量
                var bingo = 0;
                var test_submit = 0;
                var testsize = test[1][0].size;
                var time_sum = 0;
                for(var i = 0; i < test_log.length; i++){
                    accurracy += test_log[i].correct_exercise;//一共对了多少题
                    if(test_log[i].finish_time){
                        test_submit++;
                        time_sum = time_sum+test_log[i].time_consuming;
                    }
                    if(test_log[i].test_state == 100){
                        bingo++;
                    }
                }
                const avg_accurracy = (accurracy/(test_submit*testsize))? (accurracy/(test_submit*testsize)).toFixed(1) : 0;
                const avg_timeconsuming = Math.round(time_sum/test_submit);
                res.send({
                    test: test[0][0],
                    test_status: {
                        test_name: test[0][0].test_name,
                        avg_accurracy: avg_accurracy,//平均答对的题目数
                        test_students: test_log.length,
                        test_submit: test_submit,
                        bingo: bingo,
                        avg_timeconsuming: avg_timeconsuming,
                        test_size: testsize//test中的题目个数
                    }
                });
            })
        })
    }
})


//查询单个测试里的排名信息
app.post('/klmanager/getTestRankingList', function(req, res){
    if(req.body.test_id){
        getTestRankingList(req.body.test_id, test_log => {
            console.log("RankingList:"+JSON.stringify(test_log));
            res.send(test_log);
        })
    }
})

//根据testid studentid 获取该测试是否已做（isFinish）以及学生天梯分
app.post('/klmanager/getStuTestInfo', function(req, res){
    console.log("student_id testid:"+req.body.student_id+'+'+req.body.test_id);
    if(req.body.test_id){
        getStuTestInfo(req.body.student_id,req.body.test_id,testinfo => {
            console.log("testinfo:"+JSON.stringify(testinfo));
            var isFinish = testinfo[1][0].finish_time? 1 : 0;
            var student_rating = testinfo[0][0].student_rating;
            res.send({
                isFinish : isFinish,
                student_rating : student_rating
            });
        })
    }
})

//根据学生id,kpid 获取学生知识点能力综合概况（天梯分，正确率，练习次数）
app.get('/klmanager/getStuKpAbility', function(req, res) {
    getKpAbility(req.query.student_id,req.query.kpid,function(results){
        res.send(results[0]);
    });
});

//查询测试结果数据
app.post('/klmanager/getTestResult', function(req, res){
    console.log(req.body);
    if(req.body.student_id){
        getExerciseLogResult(req.body.student_id, req.body.test_id, breakdown_log => {
            var exercise_log = [];
            for(var i = 0; i < breakdown_log.length; i++){
                const b = breakdown_log[i];
                var index = b.exercise_index;
                console.log(index);
                if(exercise_log[index]){
                    // console.log("b.sn:"+b.sn);
                    exercise_log[index].breakdown_sn[b.sn-1] = {
                        sn: b.sn,
                        sn_state: b.sn_state,
                        kpid: b.kpid,
                        kpname:b.kpname
                    }
                }else{
                    exercise_log[index] = {
                        exercise_id: b.exercise_id,
                        exercise_state: b.exercise_state,
                        exercise_status: b.exercise_status,
                        start_time: b.start_time,
                        submit_time: b.submit_time,
                        answer: JSON.parse(b.answer),
                        breakdown_sn:[],
                    };
                    exercise_log[index].breakdown_sn[b.sn-1] = {
                        sn: b.sn,
                        sn_state: b.sn_state, 
                        kpid: b.kpid,
                        kpname:b.kpname
                    }
                }
            }
            getTestKpStatus(req.body.student_id, req.body.test_id, kp_results => {
                getTestLog(req.body.student_id, req.body.test_id, test_log => {
                    res.send({
                        test_log: test_log[0],
                        exercise_log: exercise_log,
                        test_kp: kp_results,
                    });
                })
            });
        })
    }
})

/**
 * 提交测试结果
 * @param  {
 *             student_id: '1',
 *             student_rating: 500,
 *             test_result: {
 *                 test_id: '28',
 *                 test_log: [{
 *                     
 *                 }],
 *                 start_time: '2017-11-29 19:00:00',
 *                 finish_time: '2017-11-29 19:05:00',
 *             }   
 *          } req  
 * @return {
 *             {
 *               delta_student_rating: delta_student_rating,
 *               delta_kp: {
 *                   kpid: '468902',
 *                   kpname: kp_rating[kpid].kpname,
 *                   kp_old_rating: kp_rating[kpid].kp_old_rating,
 *                   kp_delta_rating: kp_rating[kpid].kp_delta_rating
 *               },
 *               student_rating: student_rating,
 *             }
 *     
 *         }        [description]
 */
app.post('/klmanager/submitTest', function(req, res) {
    if(req.body.student_id && req.body.student_rating && req.body.test_result){
        var test_result = req.body.test_result;
        var correct_exercise = 0;
        const student_id = req.body.student_id;
        var student_rating = req.body.student_rating;
        //更新每个Kp的分数
        const exercise_log = test_result.exercise_log;
        console.log(exercise_log);
        const kp_rating = updateKpRating(exercise_log);
        
        var delta_student_rating = 0;

        for(var i = 0; i < exercise_log.length; i++){
            const log = exercise_log[i];
            delta_student_rating += log.delta_student_rating;
            if(exercise_log[i].exercise_state){
                correct_exercise++;
            }
            insertExerciseLog(student_id, test_result.test_id, log, results => {
                const logid = results.insertId;
                insertExerciseLogTrigger(logid);
                insertBreakdownLog(logid, log.breakdown_sn, student_id, test_result.test_id, log.exercise_id);
            });
            // //插入每条题目rating变化记录
            // sql += "insert into exercise_delta_rating(exercise_id, delta_rating) values(?, ?);";
            // params.push(exercise_log.exercise_id);
            // params.push(exercise_log.delta_exercise_rating);

            // /**
            //  * 统计正确的题目数及正确率/
            //  */
            // if(exercise_log.exercise_state){
            //     correct_exercise++;
            // }
        }
        // //更新测试者总体rating
        // student_rating = student_rating + delta_student_rating;
        // sql += "replace into student_rating(student_id, student_rating) values(?, ?);";
        // params.push(student_id);
        // params.push(student_rating);
        var sql = "";
        var params = [];
        // 更新测试信息
        if(test_result.test_id > 0){
            sql += "update test_log set ? where test_id = ? and student_id = ?;";
            params.push({
                start_time: dateParse(test_result.start_time),
                finish_time: dateParse(test_result.finish_time),
                test_state: correct_exercise/exercise_log.length,
                correct_exercise: correct_exercise,
            });
            params.push(test_result.test_id);
            params.push(student_id);
        }
        
        // //更新测试者kp_rating
        // var delta_kp = [];
        // for(var kpid in kp_rating){
        //     const kp = kpid.substring(1);
        //     //kp变化结果列表
        //     delta_kp.push({
        //         kpid: kp,
        //         kpname: kp_rating[kpid].kpname,
        //         kp_old_rating: kp_rating[kpid].kp_old_rating,
        //         kp_delta_rating: kp_rating[kpid].kp_delta_rating
        //     });
        //     var update_time = new Date();
        //     sql += "replace into student_kp set student_id = ?, kpid = ?, kp_rating = ?, update_time = ?, practice = practice + 1, correct = correct + ?;";
        //     params.push(student_id, parseInt(kp), kp_rating[kpid].kp_old_rating + kp_rating[kpid].kp_delta_rating, update_time, kp_rating[kpid].kp_delta_rating > 0 ? 1: 0);

        //     // //插入历史记录
        //     // sql += "insert into student_kp_history(student_id, kpid, kp_rating, update_time) values(?, ?, ?, ?);";
        //     // params.push(student_id, parseInt(kp), kp_rating[kpid].kp_old_rating + kp_rating[kpid].kp_delta_rating, update_time);

        // }
        query(pool, sql, params, results => {
                /**
                 * {
                 *     student_delta_rating: 6,
                 *     kp_rating: [{
                 *         old_rating: 500,
                 *         delta_Rating: 200,
                 *         kpname: 'xxxxx'
                 *     }]
                 */
            var rep = {
                delta_student_rating: delta_student_rating,
                student_reward: 35,
                student_rating: student_rating,
            };
            res.send(JSON.stringify(rep));
        });
    }
    /**
     * TO-DO: 汇总exercise_delta_rating, sn_delta_rating
     */
    // //汇总sn_delta_rating
    // sql += "update breakdown b, test t set b.sn_rating = b.sn_rating + (select sum(s.delta_rating) from sn_delta_rating s where s.exercise_id = b.exercise_id and s.sn = b.sn) where t.test_id = ? and b.exercise_id = t.exercise_id";
    // params.push(test_result.test_id);
        
        // submitStudentTest(req.body.student_id, req.body.student_rating, req.body.test_result, results => {
        //     getTestResult(req.body.student_id, test_id, results => {
        //         res.send(results);
        //     });
        // });
});

}
//app.get('/', function(req, res){  
// res.render('index', {  
//    title: 'Express'  
//  });  
//});  
//上面的代码意思是，get请求根目录则调用views文件夹中的index模板，并且传入参数title为“Express”，这个title就可以在模板文件中直接使用