var mysql = require('mysql');
var pool  = mysql.createPool({
  host     : 'rm-wz9irm56yc8scnyy6.mysql.rds.aliyuncs.com',
  // host     : 'rm-bp19507w6hl2w3rg9so.mysql.rds.aliyuncs.com',
  // host     : 'rm-bp19507w6hl2w3rg9.mysql.rds.aliyuncs.com',
  user     : 'root',
  password : '!QAZ2wsx',
  database : 'knowledge'
});

function query(pool, sql, values, callback){
    pool.getConnection(function(err, connection) {
        console.log(values);
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

function getBookChapter(course_id, callback){
    var sql = "select b.bookname, ch.bookid, ch.chapterid, ch.chaptername from chapter ch, book b where b.courseid = ? and ch.bookid = b.bookid order by chapterid asc";
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

function getUserKpByChapter(user_id, chapter_id, callback){
    var sql = "select * from user_kp u, kptable t where u.userid = ? and u.kpid = t.kpid and t.chapterid = ? ";
    var values = [user_id, chapter_id];
    query(pool, sql, values, callback);
}

function getUserKpByKpid(user_id, kpid, callback){
    var sql = "select u_kp.kpid, k.kpname, u_kp.grade, u_kp.eval_desc, u_kp.eval_time from user_kp u_kp, kptable k where u_kp.userid = ? and u_kp.kpid = ? and k.kpid = ?";
    var values = [user_id, kpid, kpid];
    query(pool, sql, values, callback);
}

function updateUserKp(user_id, kpid, grade, eval_desc, callback){
    var sql = "replace into user_kp set userid = ?, kpid = ?, grade = ?, eval_desc = ?, eval_time = ?";
    var eval_time = new Date();
    var values = [user_id, kpid, grade, eval_desc, eval_time];
    query(pool, sql, values, callback);
}

function insertUserKp(user_id, kpid, grade, eval_desc, callback){
    var sql = "insert into user_kp(userid, kpid, grade, eval_desc, eval_time) values(?, ?, ?, ?, ?)";
    var eval_time = new Date();
    var values = [user_id, kpid, grade, eval_desc, eval_time];
    query(pool, sql, values, callback, callback);
}

function findkpInUser(kpid, userkp){
    for(var i = 0; i < userkp.length; i++){
        if(kpid == userkp[i])
            return userkp[i];
    }
}

module.exports = function(app){
//处理GET请求
//http://127.0.0.1:3000/hello/?name=wujintao&email=cino.wu@gmail.com 
app.get('/usermanager/getBookChapter', function(req, res){  
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
//以上表示凡是url能够匹配/hello/*的GET请求，服务器都将向客户端发送字符串“Hello World"  

app.get('/usermanager/getuserkp', function(req, res){
    getChapterKp(req.query.chapterid, function(chapterkp){
        getUserKpByChapter(req.query.userid, req.query.chapterid, function(userkp){
            var rep = [];
            for(var i = 0; i < chapterkp.length; i++){
                var kpitem = findkpInUser(chapterkp[i].kpid, userkp);
                if(typeof(kpitem) == 'undefined'){
                    rep.push({'kpid': chapterkp[i].kpid,
                        'kpindex': chapterkp[i].kpindex, 
                        'kpname': chapterkp[i].kpname, 
                        'grade': -1, 
                        'eval_desc': '',
                        'eval_time': '',
                    });
                    console.log(JSON.stringify(rep));
                }else{
                    console.log(kpitem);
                    rep.push({'kpid': chapterkp[i].kpid,
                        'kpindex': chapterkp[i].kpindex, 
                        'kpname': chapterkp[i].kpname, 
                        'grade': kpitem.grade, 
                        'eval_desc': kpitem.eval_desc,
                        'eval_time': kpitem.eval_time,
                    });
                }
            }
            res.send(rep);
        });
    });
})

app.post('/usermanager/evaluserkp', function(req, res){
    var userid = req.body.userid;
    var kpid = req.body.kpid;
    var grade = req.body.grade;
    var eval_grade = -1;
    switch(grade){
        case 'A':
            eval_grade = 80;
            break;
        case 'B':
            eval_grade = 60;
            break;
        case 'C':
            eval_grade = 0;
            break;
    }
    var eval_desc = req.body.eval_desc;
    if(userid && kpid && eval_grade > 0){
        updateUserKp(userid, kpid, eval_grade, eval_desc, function(results){
            getUserKpByKpid(userid, kpid, function(results){
                res.send(results);
            })
        });
        // getUserKpByKpid(userid, kpid, function(userkp){
        //     if(userkp){
        //         //已有评估字段
        //         upateUserKp(userid, kpid, grade, eval_desc, function(results){
        //             res.send({userid: userid, kpid: kpid, grade: grade, eval_desc: eval_desc, eval_time: eval_time});
        //         });
        //     }else{
        //         insertUserKp(userid, kpid, grade, eval_desc, function(results){
        //             res.send({userid: userid, kpid: kpid, grade: grade, eval_desc: eval_desc, eval_time: eval_time});
        //         });
        //     }
        // });  
    }
    
})

}
//app.get('/', function(req, res){  
// res.render('index', {  
//    title: 'Express'  
//  });  
//});  
//上面的代码意思是，get请求根目录则调用views文件夹中的index模板，并且传入参数title为“Express”，这个title就可以在模板文件中直接使用