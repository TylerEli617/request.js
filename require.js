/*
   Copyright 2016 h_ELI_x

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/   

(function(document)
{
    var globalEval = eval;
    var modules = {};
    var scriptroot = "";
    
    function getModule(id)
    {
        if (!modules[id])
        {
            modules[id] = new Module(id);
        }
        
        return modules[id];
    }
    
    function Module(id)
    {
        this.state = "initial";
        this.exports = {};
        this.id = id;
        this.source = "";
        this.error = null;
        
        this.require = function()
        {
            if (this.state == "loaded")
            {
                return this.exports;
            }
            else if (this.state == "loading")
            {
                return this.exports;
            }
            else if (this.state == "failed")
            {
                throw this.error;
            }
            else
            {
                return this.synchronusStateTransition();
            }
        };
        
        this.synchronusStateTransition = function()
        {
            if (this.state == "initial")
            {
                this.acquiringSource();
            }
            
            try
            {
                this.setSource(getSource(this.id));
            }
            catch (error)
            {
                this.fail(error);
                throw error;
            }
            
            this.loadModule();
            
            if (this.state == "loading")
            {
                throw new Error("You are attempting to require a module that is executing a defered load.");
            }
            else if (this.state == "failed")
            {
                throw this.error;
            }
            
            return this.exports;
        };
        
        this.stable = function()
        {
            return ((this.state == "failed") || (this.state == "loaded"));
        };
        
        this.fail = function(error)
        {
            if (this.stable())
            {
                throw new Error("The module " + id + " is in a stable state and can not go into the failed state.");
            }
            
            this.state = "failed";
            this.error = error;
        };
        
        this.acquiringSource = function()
        {
            if (this.state != "initial")
            {
                throw new Error("A module can only transition to the acquiring source state from the initial state.");
            }
            
            this.state = "acquiring source";
        };
        
        this.setSource = function(source)
        {
            if (this.state != "acquiring source")
            {
                throw new Error("A module's source can only be set after it has entered the acquiring source state.");
            }
            
            this.state = "sourced";
            this.source = source;
        };
        
        this.loadModule = function()
        {
            if (this.state != "sourced")
            {
                throw new Error("A module can only be loaded after it has entered the sourced state.");
            }
            
            this.state = "loading";
            var module = this;
            var perspective = this.id.substring(0, this.id.lastIndexOf("/") + 1);
            
            function require(id)
            {
                return perspectiveRequire(id, perspective);
            }
            
            try
            {
                (globalEval("(function(require, module, exports){" + this.source + "})"))(require, this, this.exports);
                this.state = "loaded";
            }
            catch(error)
            {
                this.fail(error);
            }
        }
    }
    
    function normalizeID(id, perspective)
    {
        if (id.indexOf("://") != -1)
        {
            return id;
        }
        else if (id[0] == ".")
        {
            id = perspective + id
        }
        else if (id[0] != "/")
        {
            id = scriptroot + "/" + id;
        }
        
        var idParts = id.split("/");
        var idPartsCount = idParts.length;
        var normalizedIDParts = [];

        for(var index = 0;index < idPartsCount;index++)
        {
            if(idParts[index] == ".")
            {
                continue;
            }
            else if(idParts[index] == "..")
            {
                normalizedIDParts.pop();
            }
            else
            {
                normalizedIDParts.push(idParts[index]);
            }
        }

        var normalizedID = "";
        var normalizedIDPartsCount = normalizedIDParts.length;

        for(var index = 0;index < normalizedIDPartsCount;index++)
        {
            if(normalizedIDParts[index] != "")
            {
                normalizedID = normalizedID + "/" + normalizedIDParts[index];
            }
        }

        return normalizedID;
    }

    function getSource(id)
    {
        var moduleRequest = new XMLHttpRequest();
        moduleRequest.open("GET", id + ".js", false);
        moduleRequest.send(null);

        if ((moduleRequest.readyState == XMLHttpRequest.DONE) && (moduleRequest.status == 200))
        {
            return moduleRequest.response;
        }
        else
        {
            throw new Error(moduleRequest.statusText);
        }
    }

    function perspectiveRequire(id, perspective)
    {
        return getModule(normalizeID(id, perspective)).require();
    }
    
    if (document.currentScript.dataset.scriptroot)
    {
        scriptroot = document.currentScript.dataset.scriptroot;
    }
    
    perspectiveRequire(document.currentScript.dataset.main, scriptroot);
}(document))