var mysql = require('mysql');
var pool  = mysql.createPool({
  host     : 'rm-wz9irm56yc8scnyy6.mysql.rds.aliyuncs.com',
  // host     : 'rm-bp19507w6hl2w3rg9so.mysql.rds.aliyuncs.com',
  // host     : 'rm-bp19507w6hl2w3rg9.mysql.rds.aliyuncs.com',
  user     : 'root',
  password : '!QAZ2wsx',    
  database : 'knowledge',
  multipleStatements: true
});
// var pool  = mysql.createPool({
//   host     : '127.0.0.1',
//   user     : 'root',
//   password : 'root',
//   database : 'knowledge',
//   multipleStatements: true
// });

var redis = require('redis'),
    RDS_PORT = 6379,
    RDS_HOST = '39.108.85.119',
    RDS_PWD = '123456',
    RDS_OPTS = {auth_pass: RDS_PWD},
    client = redis.createClient(RDS_PORT, RDS_HOST, RDS_OPTS);


function query(pool, sql, values, callback){
    pool.getConnection(function(err, connection) {
        console.log(sql);
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

/**********获取题目id**********/
function produceExerciseId(course_id, callback){
    client.hincrby('exercise_sequence', course_id, 1, callback);    
}
/**********获取题目id**********/

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

//添加题目
function addExercise(exercise, exercise_id, callback){
    var sql = "insert into exercise set ?;";
    var params = {
        exercise_id: exercise_id,
        title: exercise.title, 
        title_img_url: exercise.title_img_url,
        title_audio_url: exercise.title_audio_url, 
        answer: JSON.stringify(exercise.answer), 
        exercise_rating: exercise.exercise_rating, 
        exercise_type: exercise.exercise_type
    };
    query(pool, sql, params, callback);
}

//添加答案分解
function addBreakdown(exercise_id, breakdown, callback){
    var sql = "";
    var params = [];
    for(var i = 0; i < breakdown.length; i++){
        sql = sql + "insert into breakdown set ?;"
        params.push({exercise_id: exercise_id, sn: breakdown[i].sn, content: breakdown[i].content, presn: breakdown[i].presn, sn_rating: breakdown[i].sn_rating, kpid: breakdown[i].kpid});
    }
    query(pool, sql, params, callback);
}

//挂载题目到知识点
function addKpExercise(exercise_id, breakdown, callback){
    var sql = "";
    var params = [];
    console.log("breakdown:" + breakdown);
    for(var i = 0; i < breakdown.length; i++){
        if(breakdown[i].checked){
            sql = sql + "replace into kp_exercise set ?;"
            params.push({exercise_id: exercise_id, kpid: breakdown[i].kpid});   
        }
    }
    query(pool, sql, params, callback);
}

//更新题目信息
function updateExercise(exercise, callback){
    var sql = "replace into exercise set ?;";
    var params = {
            title: exercise.title, 
            title_img_url: exercise.title_img_url, 
            title_audio_url: exercise.title_audio_url,
            answer: JSON.stringify(exercise.answer), 
            exercise_rating: exercise.exercise_rating, 
            exercise_type: exercise.exercise_type,
            exercise_id: exercise.exercise_id
        };
    query(pool, sql, params, callback);
}

//更新答案知识点分解
function updateBreakdown(exercise_id, breakdown, callback){
    //TODO: 存在同步问题
    var sql = "delete from breakdown where exercise_id = ?;";
    //var sql = "";
    var params = [exercise_id];
    for(var i = 0; i < breakdown.length; i++){
        sql = sql + "insert into breakdown set ?;"
        params.push({exercise_id: exercise_id, sn: breakdown[i].sn, sn_rating: breakdown[i].sn_rating, content: breakdown[i].content, presn: breakdown[i].presn, kpid: breakdown[i].kpid, sn_rating: breakdown[i].sn_rating});
    }
    query(pool, sql, params, callback);
}

//根据exercise_id获取题目
function getExerciseByExid(exercise_id, callback){
    var sql = "select e.* , b.*, t.kpname from exercise e, breakdown b, kptable t where e.exercise_id = ? and b.exercise_id = e.exercise_id and b.kpid = t.kpid";
    query(pool, sql, [exercise_id], callback);
}

function getKpExercise(exercise_id, callback){
    var sql = "select kpid from kp_exercise k where exercise_id = ?;";
    query(pool, sql, [exercise_id], callback);
}

function getCourse(callback){
    var sql = "select c.* from course c;";
    query(pool, sql, [], callback);
}


module.exports = function(app){
//处理GET请求
//http://127.0.0.1:3000/hello/?name=wujintao&email=cino.wu@gmail.com 
app.get('/klmanager/getChapterKp', function(req, res){  
    console.log(req.query.chapter_id);
    getChapterKp(req.query.chapter_id, function(results){
        res.send(results);
    });
    
});

//获取所有书章
app.get('/klmanager/getBookChapter', function(req, res){  
    console.log(req.query.course_id);

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


//根据知识点获取挂载的题目
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
                        exercise_type: e.exercise_type, 
                        title: e.title, 
                        answer: e.answer,
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

//根据exercise_id获取exercise
app.get('/klmanager/getExercise', function(req, res) {
    if (req.query.exercise_id) {
        console.log(req.query.exercise_id);
        getExerciseByExid(req.query.exercise_id, function(results){
            if(!results[0]){
                res.send({exercise_id: req.query.exercise_id});
            }else{
            getKpExercise(req.query.exercise_id, function(kp_exercise){
                var kpids = [];
                for(var i = 0; i < kp_exercise.length; i++){
                    kpids['#' + kp_exercise[i].kpid] = true;
                }
                console.log(kpids);
                var breakdown = [];
                for(var i = 0; i < results.length; i++){
                    breakdown.push({
                        sn: results[i].sn, 
                        content: results[i].content, 
                        presn: results[i].presn, 
                        kpid: results[i].kpid,
                        kpname: results[i].kpname,
                        sn_rating : results[i].sn_rating,
                        checked: kpids['#' + results[i].kpid]?true:false//记录主测点
                    });
                }
                var exercise = {
                    exercise_id: results[0].exercise_id, 
                    exercise_type: results[0].exercise_type, 
                    title: results[0].title, 
                    title_img_url: results[0].title_img_url,
                    title_audio_url: results[0].title_audio_url,
                    answer: results[0].answer,
                    exercise_rating: results[0].exercise_rating, 
                    breakdown: breakdown
                }; 
                console.log(exercise);
                res.send(exercise);
            });
            }
        });
    }
});

//获取所有course
app.get('/klmanager/getCourse', function(req, res){  
    getCourse(function(results){
        console.log(results);
        res.send(results);
    });
    
});

  
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

//增加一条题目
app.post('/klmanager/addExercise', function(req, res) {
    if (req.body.exercise) {
        produceExerciseId(req.body.course_id, function(err, reply){
            const exercise_id = reply;
            console.log(exercise_id);
            addExercise(req.body.exercise, exercise_id, function(results){
                // const exercise_id = results.insertId;
                addBreakdown(exercise_id, req.body.exercise.breakdown, function(){
                    //无主测点时不更新
                    var mask = 0;
                    for(var i = 0; i < req.body.exercise.breakdown.length; i++){
                        if(req.body.exercise.breakdown[i].checked){
                            mask = 1;
                        }
                    }
                    if(mask){
                        addKpExercise(exercise_id, req.body.exercise.breakdown, function(){
                            res.send({"exercise_id": exercise_id});
                        });
                    }else{
                        res.send({"exercise_id": exercise_id});
                    }
                });
            });
        });
        
    }
});


//更新题目
app.post('/klmanager/updateExercise', function(req, res) {
    if (req.body.exercise) {
        console.log('update');
        console.log('req.body.exercise:'+JSON.stringify(req.body.exercise));
        updateExercise(req.body.exercise, function(results){
            updateBreakdown(req.body.exercise.exercise_id, req.body.exercise.breakdown, function(results){
                //无主测点时不更新
                var mask = 0;
                for(var i = 0; i < req.body.exercise.breakdown.length; i++){
                    if(req.body.exercise.breakdown[i].checked){
                        mask = 1;
                    }
                }
                if(mask){
                    addKpExercise(req.body.exercise.exercise_id, req.body.exercise.breakdown, function(){
                        res.send({"exercise_id": req.body.exercise.exercise_id});
                    });
                }else{
                    res.send({"exercise_id": req.body.exercise.exercise_id});
                }
            });
        });
    }
});

//更新breakdown
app.post('/klmanager/updateBreakdown', function(req, res) {
    if (req.body.exercise) {
        updateBreakdown(req.body.exercise.exercise_id, req.body.exercise.breakdown, function(results){
            //无主测点时不更新
            var mask = 0;
            for(var i = 0; i < req.body.exercise.breakdown.length; i++){
                if(req.body.exercise.breakdown[i].checked){
                    mask = 1;
                }
            }
            if(mask){
                addKpExercise(req.body.exercise.exercise_id, req.body.exercise.breakdown, function(){
                    res.send({"exercise_id": req.body.exercise.exercise_id});
                });
            }else{
                res.send({"exercise_id": req.body.exercise.exercise_id});
            }
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