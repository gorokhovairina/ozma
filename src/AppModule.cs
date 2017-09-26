namespace FunWithFlags.FunApp
{
    using System;
    using System.Linq;
    using Microsoft.EntityFrameworkCore;
    using System.Collections.Generic;
    using Nancy;
    using Nancy.Security;
    using System.Dynamic;

    using FunWithFlags.FunCore;
    using FunWithFlags.FunDB.Context;
    using FunWithFlags.FunApp.Views;

    public class AppModule : NancyModule
    {
        private ExpandoObject GetMenuBar(DatabaseContext db, UserView currUv)
        {
            // Временная реализация меню - Вывести в одельную функцию и привязать ко всем вью.cs

            /*
            Первым элементом добавляем 3 элемента
                название сущностей через запятую привязанные к этому представлению 
                и ссылка на меню навигации
                подменю этому элементу оставляем пустым
            
            Если этот вид юзервью выводит данные сразу по многим записям
                Вторым элементом добавляем 3 элемента 
                    текущее название юзервью 
                    и ссылку на него
                    Подменю
                        Все юзервью кроме этого отсортированные в алфавитном порядке
            Иначе(Если этот вид юзервью выводит данные по одной записи)
                Вторым элементом добавляем 3 элемента 
                    Название основного для этой сущности юзервью
                    и ссылку на него
                    Подменю
                        Все юзервью кроме этого отсортированные в алфавитном порядке
                Доабавляем третий элемент
                    Текущий юзервью
                    Ссылка на него
                    Подменю
                        Все юзервью выводящие данные по 1 записи кроме текущего
            */

            // Используемые сущности

            var entitiesQuery = db.Entities.Where(e =>
                db.UVEntities.Where(uve => 
                    uve.UserViewId == currUv.Id && uve.EntityId == e.Id
                ).Any()
            );
            var entities = entitiesQuery.First().DisplayNamePlural;


            // Массивы

            var viewsMultiple = new [] { "Table" };


            // Первый пернкт меню

            dynamic menuModel = new ExpandoObject();
            menuModel.Ent = new ExpandoObject();
            menuModel.Lists = new List<ExpandoObject>();
            menuModel.BarButtons = new List<ExpandoObject>();

            menuModel.Ent.Name = entities;
            menuModel.Ent.Link = "../nav";
            menuModel.Ent.Color = db.Settings.Single(s => s.Name == "bgcolor").Value;


            // Второй пункт меню

            UserView tView = currUv;
            if (!viewsMultiple.Contains(currUv.Type)) {
                tView = db.UserViews.First(uv =>
                    viewsMultiple.Contains(uv.Type) &&
                    db.UVEntities.Where(uve =>
                        uve.UserViewId == uv.Id && 
                        entitiesQuery.Where(e => e.Id == uve.EntityId).Any()
                    ).Any()
                );
            }
            var userViews = db.UserViews.Where(uv =>
                viewsMultiple.Contains(uv.Type) && 
                db.UVEntities.Where(uve =>
                    uve.UserViewId == uv.Id && 
                    entitiesQuery.Where(e => e.Id == uve.EntityId).Any()
                ).Any()
            ).ToList();

            dynamic subMenuModel2 = new ExpandoObject();
            subMenuModel2.Name = tView.Name;
            subMenuModel2.Link = System.String.Format("../uv/{0}",tView.Id);
            subMenuModel2.Sub = new List<ExpandoObject>();
            subMenuModel2.Color = db.Settings.Single(s => s.Name == "bgcolor").Value;
            menuModel.Lists.Add(subMenuModel2);


            // Подменю второго пункта
            dynamic subMenuModel3 = new ExpandoObject();
            for(int i = 0; i < userViews.Count; i++){
                subMenuModel3.Name = userViews[i].Name;
                subMenuModel3.Link = System.String.Format("../uv/{0}",userViews[i].Id);
                subMenuModel3.Color = db.Settings.Single(s => s.Name == "bgcolor").Value;
                menuModel.Lists[0].Sub.Add(subMenuModel3);
            }

            // Третий пункт (опицонально)

            if (!viewsMultiple.Contains(currUv.Type)) {
                dynamic subMenuModel4 = new ExpandoObject();
                subMenuModel4.Name = currUv.Name;
                subMenuModel4.Link = System.String.Format("../uv/{0}",currUv.Id);
                subMenuModel4.Sub = new List<ExpandoObject>();
                subMenuModel4.Color = db.Settings.Single(s => s.Name == "bgcolor").Value;
                menuModel.Lists.Add(subMenuModel4);


                // Подменю третьего пункта

                var userViews2 = db.UserViews.Where(uv =>
                    !viewsMultiple.Contains(uv.Type) && 
                    db.UVEntities.Where(uve =>
                        uve.UserViewId == uv.Id && 
                        entitiesQuery.Where(e => e.Id == uve.EntityId).Any()
                    ).Any()
                ).ToList();

                for(int i = 0; i < userViews2.Count; i++){
                    dynamic subMenuModel5 = new ExpandoObject();
                    subMenuModel5.Name = userViews2[i].Name;
                    subMenuModel5.Link = System.String.Format("../uv/{0}",userViews2[i].Id);
                    subMenuModel5.Color = db.Settings.Single(s => s.Name == "bgcolor").Value;
                    menuModel.Lists[1].Sub.Add(subMenuModel5);
                };
              };
            //Меню Действия с кнопками
            var barButtons = db.MenuBarButtons.Where(b =>
               b.UserViewId == currUv.Id
               ).OrderBy(t => t.OrdinalNum).ToList();
            var vvv = db.UserViews.ToList();
            // находим UserView 
            var userViewsF = db.UserViews.Where(uv =>
                    !viewsMultiple.Contains(uv.Type) &&
                    db.UVEntities.Where(uve =>
                        uve.UserViewId == uv.Id &&
                        entitiesQuery.Where(e => e.Id == uve.EntityId).Any()
                    ).Any()
                ).ToList();
            //Меню Действия
            dynamic menuActions = new ExpandoObject();
            menuActions.Name = "Действия";
            menuActions.Link = "";
            menuActions.Sub = new List<ExpandoObject>();
            menuActions.Color = db.Settings.Single(s => s.Name == "bgcolor").Value;
            menuModel.Lists.Add(menuActions);
            //Подменю с кнопками
            int cnt = menuModel.Lists.Count;
            for (int i = 0; i < barButtons.Count; i++)
            {
                dynamic subMenuBarButton = new ExpandoObject();
                subMenuBarButton.Name = barButtons[i].Name;
                subMenuBarButton.Link = System.String.Format(barButtons[i].Href, userViewsF[0].Id);
                subMenuBarButton.Color = db.Settings.Single(s => s.Name == "bgcolor").Value;
                menuModel.Lists[cnt-1].Sub.Add(subMenuBarButton);
            };
                        
            return menuModel;
        }

        public AppModule(Context ctx)
        {
            this.RequiresAuthentication();
            var db = ctx.Database;

            Get("/", _ =>
            {
                return this.Response.AsRedirect("~/nav");
            });

            Get("/nav/", _ =>
            {
                // Массивы
                var viewsMultiple = new [] { "Table" };

                var model = new
                {
                    // ! Создаем модель выгружаем данные по сущностям из базы на основании доступов пользователя к этим сущностям
                    MenuCategories = db.MenuCategories.GroupJoin(db.Entities,
                        category => category.Id,
                        entity => entity.MenuCategoryId,
                        (category, entities) => new {
                            Category = category, 
                            Entities = entities.GroupJoin(db.UVEntities,
                                e => e.Id,
                                uve => uve.EntityId,
                                (e, uves) => new {
                                    DisplayNamePlural = e.DisplayNamePlural,
                                    OrdNum = e.MenuCategoryOrdinalNum,
                                    Link = System.String.Format("../uv/{0}",
                                        uves.First(myuve =>
                                            db.UserViews.Where(myuv =>
                                                myuv.Id == myuve.UserViewId &&
                                                viewsMultiple.Contains(myuv.Type)
                                            ).Any()
                                        ).UserViewId
                                    )
                                }
                            ).OrderBy(t => t.OrdNum).ToList()
                        }
                    // Удаляем пустые менюкатегории (без Сущностей)
                    ).Where((mc) => mc.Entities.Count != 0).OrderBy(t => t.Category.OrdinalNum).ToList(),

                    Color = db.Settings.Single(s => s.Name == "bgcolor").Value
                };

                return View["Navigator", model];
            });

            Get(@"/uv/{Id:int}/", pars =>
            {
                var id = (int)pars.Id;
                var uv = db.UserViews.FirstOrDefault(u => u.Id == id);
                if (uv == null)
                {
                    throw new ArgumentException($"User view doesn't exist: {uv}");
                }

                // ! Переписать на динамический поиск через Reflection
                View view = null;
                switch (uv.Type)
                {
                    case "Table":
                        view = new TableView();
                        break;
                    case "Form":
                        view = new FormView();
                        break;
                    default:
                        throw new ArgumentException($"Unknown view type: {uv.Type}");
                }

                /*
                Создаем модель меню, берем данные из базы с доступами пользователя к сущности и юзервью
                Если модель не пустая {
                    Создаем модель данных, берем данные из базы с доступами пользователя к запис(и)ям и фильтрами из юзервью
                    Если модель не пустая {
                        Идем по всем полям сущности, используемым в текущем юзервью {
                            Проверяем доступ пользоваеля к полю {
                                Если нет доступа на чтение поля
                                    Помечаем, что поле не доступно для чтения (При выводе поменяем значения полей на "********")
                                Если тип юзервью позволяет редактирование
                                    Если поле недоступно для рекдактирования
                                        Помечаем запись в модели как недоступное для рекдактирования (При выводе сделаем не доступным для редактирования)
                            }
                        }
                        Если тип юзервью поддерживает сортировку {
                            Если есть параметр сортировка в ссылке
                                Сортируем по нему
                            Иначе (если параметра сортировка в ссылке нету)
                                Сортируем по дате создания записи - новые наверх
                        }
                    }
                } иначе (если модель пустая) {
                    Выводим страницу ошибки "У вас нет досутпа к этим данным"
                }

                Запускаем sshtml с выгруженной моделью меню и данных
                */

                var tModel = view.Get(ctx, uv, this.Request.Query);
                tModel.MenuBar = this.GetMenuBar(db, uv);
                return View[view.ViewName, tModel];
            });
        }
    }
}
